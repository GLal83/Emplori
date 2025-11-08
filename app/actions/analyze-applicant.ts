"use server"

import { generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

// Schema for the analysis result
const analysisSchema = z.object({
  overallRating: z.number().min(1).max(10).describe("Overall candidate rating from 1-10"),
  pros: z.array(z.string()).describe("List of strengths and positive attributes (3-5 items)"),
  potentialDiscussionPoints: z.array(z.string()).describe("Potential discussion points for interview (2-4 items) - NOT weaknesses or cons, but questions to explore"),
  summary: z.string().describe("Brief summary of the candidate (2-3 sentences)"),
  jobMatches: z.array(
    z.object({
      jobId: z.string().describe("The ID of the job order"),
      jobTitle: z.string().describe("The job title"),
      matchScore: z.number().min(0).max(100).describe("Match score from 0-100"),
      matchReason: z.string().describe("Why this candidate is a good fit for this role"),
      concerns: z.string().optional().describe("Any concerns about this match"),
    })
  ).describe("List of matching job orders with scores >= 65 and reasoning"),
})

// Initialize the Google AI client
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
})

/**
 * Fetch a resume file from URL and convert to base64
 */
async function fetchResumeAsBase64(resumeUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(resumeUrl)
    if (!response.ok) {
      console.error("[ANALYSIS] Failed to fetch resume:", response.statusText)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")

    // Determine MIME type from URL or response headers
    const contentType = response.headers.get("content-type") || "application/pdf"
    const mimeType = contentType.includes("pdf")
      ? "application/pdf"
      : contentType.includes("docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : contentType.includes("doc")
      ? "application/msword"
      : "application/pdf" // default

    return { base64, mimeType }
  } catch (error) {
    console.error("[ANALYSIS] Error fetching resume:", error)
    return null
  }
}

interface ApplicantData {
  fullName: string
  currentJobTitle: string
  currentCompany: string
  primarySkill: string
  totalYOE: number
  location: string
  availability: string
  desiredSalary?: string
  secondarySkills: string[]
  notes?: string
  resume?: string // Resume URL
}

interface JobOrderData {
  id: string
  jobTitle: string
  clientCompany: string
  salaryRange: string
  status: string
  priority: string
  notes?: string
}

/**
 * Analyze an applicant and match them with open job orders
 * 
 * @param applicant - The applicant data to analyze (includes resume URL if available)
 * @param jobOrders - List of open job orders to match against
 */
export async function analyzeApplicant(
  applicant: ApplicantData,
  jobOrders: JobOrderData[]
) {
  console.log("[ANALYSIS] Starting applicant analysis...")
  console.log("[ANALYSIS] Applicant:", applicant.fullName)
  console.log("[ANALYSIS] Resume available:", !!applicant.resume)
  console.log("[ANALYSIS] Job orders to match:", jobOrders.length)

  // Fetch resume if available
  let resumeData: { base64: string; mimeType: string } | null = null
  if (applicant.resume && applicant.resume.trim() !== "") {
    console.log("[ANALYSIS] Fetching resume from:", applicant.resume)
    resumeData = await fetchResumeAsBase64(applicant.resume)
    if (resumeData) {
      console.log("[ANALYSIS] Resume fetched successfully")
    } else {
      console.warn("[ANALYSIS] Failed to fetch resume, proceeding with structured data only")
    }
  }

  // Filter to only open job orders
  const openJobs = jobOrders.filter(
    (job) => job.status === "Open" || job.status === "Interviewing"
  )

  if (openJobs.length === 0) {
    return {
      success: true,
      data: {
        overallRating: 0,
        pros: [],
        potentialDiscussionPoints: ["No open job orders available for matching"],
        summary: "No open positions available to match this candidate against.",
        jobMatches: [],
      },
    }
  }

  const PROMPT = `

You are an expert AI recruitment assistant for EMPLORI RECRUITING SERVICES, specializing in Canadian personal injury law recruitment.



Your task is to perform a DEEP SEMANTIC ANALYSIS of a candidate's resume and provide:

1. An overall rating (1-10)

2. Pros (strengths)

3. Potential Discussion Points (not 'Cons' or 'weaknesses')

4. A brief summary

5. Match this candidate with open job orders.



**CRITICAL: SEMANTIC ANALYSIS APPROACH**

Your goal is to think like a senior recruiter.



1.  **Focus on RELEVANT CANADIAN EXPERIENCE.** A candidate's prior career in another country (e.g., "Lawyer in Brazil") is context but should NOT be seen as a "con" or "lack of progression." Focus on their Canadian work history.

2.  **Value Longevity Over "Job Hopping":** If a candidate has extensive total experience (e.g., 10+ years), this *outweighs* concerns about a few short-term roles. Do not penalize a senior candidate for this.

3.  **Understand the Role:** Do not misinterpret core tasks (like "drafting legal documents" or "managing files") as "clerical." These are *essential functions* of a Law Clerk.



**STRUCTURED DATA (for reference only - use resume content as primary source):**

- Name: ${applicant.fullName}

- Current Position: ${applicant.currentJobTitle} at ${applicant.currentCompany}

- Years of Experience: ${applicant.totalYOE} (verify this against actual resume work history)

- Location: ${applicant.location}

- Availability: ${applicant.availability}

- Desired Salary: ${applicant.desiredSalary || "Not specified"}

- Recruiter Notes: ${applicant.notes || "None"}



**OPEN JOB ORDERS:**

${openJobs

  .map(

    (job, index) => `

Job ${index + 1}:

- ID: ${job.id}

- Title: ${job.jobTitle}

- Company: ${job.clientCompany}

- Salary Range: ${job.salaryRange}

- Priority: ${job.priority}

- Core Responsibilities: ${job.notes || "No description provided."}

`

  )

  .join("\n")}



**ANALYSIS INSTRUCTIONS (Return JSON):**



1. **Overall Rating (1-10)**:

   - Base this on their *Relevant Canadian Experience* and *Skill Depth*.

   - 8-10: Excellent candidate with deep, relevant experience.

   - 1-3: Weak candidate, clear lack of relevant Canadian experience.



2. **Pros** (3-5 items):

   - **MUST** highlight total years of *relevant* experience (e.g., "19 years of experience as a Law Clerk in Toronto").

   - List specific, relevant skills (e.g., "Direct experience with Accident Benefits (AB) and CAT files").



3. **Potential Discussion Points** (2-4 items):

   - **DO NOT list "Cons" or "Weaknesses".**

   - Frame concerns as questions for an interview.

   - (e.g., "Candidate has several short-term roles; worth discussing their career path.")

   - (e.g., "Ask candidate to elaborate on the scope of their 'Senior Law Clerk' responsibilities.")



4. **Summary** (2-3 sentences):

   - A professional overview of the candidate, highlighting their *relevant* Canadian role and experience.



5. **Job Matches**:

   - **STEP 1: SEMANTIC MATCH (The "Stupid" Filter).** For each job, first check if the candidate's semantic role (e.g., "Law Clerk") matches the job's role (e.g., "Accident Benefits Clerk").

     - **If it's a mismatch** (e.g., Candidate is "Law Clerk," Job is "Productions Clerk" [a logistics/admin role]), **DISQUALIFY IT**. Do not include it in the list.

   - **STEP 2: CALCULATE FIT SCORE (0-100).** For *semantically matching* jobs only:

     - **40% - Relevant Experience (RYE):** How many years has the candidate done this *exact type* of work? (e.g., 19 years as a Law Clerk).

     - **30% - Core Function & Skill Overlap:** How well do their resume tasks match the job's "Core Responsibilities"? (e.g., "Handles AB files" matches "Accident Benefits Clerk").

     - **20% - Salary & Location Fit:** Are they compatible?

     - **10% - Seniority Fit:** Does their experience level (e.g., Senior) match the role?

   - **STEP 3: OUTPUT.**

     - Provide a match score for all jobs with a score **>= 65**.

     - Provide clear reasoning for the score.

     - If no jobs score >= 65, return an empty \`jobMatches\` array.



Now perform a deep semantic analysis of the resume and provide the structured assessment.

`

  try {
    // Build message content - include resume file if available
    const messageContent: any[] = [
      {
        type: "text",
        text: PROMPT,
      },
    ]

    // Add resume file if available
    if (resumeData) {
      messageContent.push({
        type: "text",
        text: "\n\n[RESUME FILE ATTACHED - Analyze the full resume content above]",
      })
      messageContent.push({
        type: "file",
        data: resumeData.base64,
        mediaType: resumeData.mimeType,
      })
    }

    const { object } = await generateObject({
      model: googleAI("gemini-2.0-flash"),
      schema: analysisSchema,
      messages: [
        {
          role: "user",
          content: messageContent.length === 1 ? messageContent[0].text : messageContent,
        },
      ],
    })

    console.log("[ANALYSIS] Analysis completed successfully")
    console.log("[ANALYSIS] Overall rating:", object.overallRating)
    console.log("[ANALYSIS] Job matches found:", object.jobMatches.length)

    return {
      success: true,
      data: object,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[ANALYSIS] Analysis error:", errorMessage)

    return {
      success: false,
      error: `Failed to analyze candidate: ${errorMessage}`,
    }
  }
}

