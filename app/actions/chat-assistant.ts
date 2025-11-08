"use server"

import { generateText, generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

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
      console.error("[CHAT] Failed to fetch resume:", response.statusText)
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
    console.error("[CHAT] Error fetching resume:", error)
    return null
  }
}

interface ApplicantData {
  id: string
  fullName: string
  currentJobTitle: string
  currentCompany: string
  primarySkill: string
  totalYOE: number
  location: string
  availability: string
  desiredSalary?: string
  secondarySkills: string[]
  status: string
  source: string
  dateApplied: string
  email: string
  phone: string
  linkedinUrl?: string
  resume?: string
  notes?: string
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

interface ClientData {
  id: string
  companyName: string
  industry: string
  location: string
  status: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Chat assistant that has access to all app data
 * Can help filter, search, and analyze candidates, jobs, and clients
 */
export async function chatAssistant(
  message: string,
  conversationHistory: ChatMessage[],
  applicants: ApplicantData[],
  jobOrders: JobOrderData[],
  clients: ClientData[]
) {
  console.log("[CHAT] Processing message:", message)
  console.log("[CHAT] Conversation history length:", conversationHistory.length)
  console.log("[CHAT] Data available - Applicants:", applicants.length, "Jobs:", jobOrders.length, "Clients:", clients.length)

  // Build context from available data
  const applicantsContext = applicants
    .map(
      (app) => `
ID: ${app.id}
Name: ${app.fullName}
Current Role: ${app.currentJobTitle} at ${app.currentCompany}
Experience: ${app.totalYOE} years
Primary Skill: ${app.primarySkill}
Secondary Skills: ${app.secondarySkills.join(", ") || "None"}
Location: ${app.location}
Availability: ${app.availability}
Desired Salary: ${app.desiredSalary || "Not specified"}
Status: ${app.status}
Source: ${app.source}
Date Applied: ${app.dateApplied}
${app.resume ? `Resume URL: ${app.resume}` : "Resume: Not available"}
${app.linkedinUrl ? `LinkedIn: ${app.linkedinUrl}` : ""}
${app.notes ? `Notes: ${app.notes}` : ""}
`
    )
    .join("\n---\n")

  const jobsContext = jobOrders
    .map(
      (job) => `
ID: ${job.id}
Title: ${job.jobTitle}
Company: ${job.clientCompany}
Salary Range: ${job.salaryRange}
Status: ${job.status}
Priority: ${job.priority}
${job.notes ? `Notes: ${job.notes}` : ""}
`
    )
    .join("\n---\n")

  const clientsContext = clients
    .map(
      (client) => `
ID: ${client.id}
Company: ${client.companyName}
Industry: ${client.industry}
Location: ${client.location}
Status: ${client.status}
`
    )
    .join("\n---\n")

  const systemPrompt = `You are an expert AI recruitment assistant for EMPLORI RECRUITING SERVICES, specializing in Canadian recruitment.

You have access to the complete database of:
- ${applicants.length} applicants/candidates
- ${jobOrders.length} job orders
- ${clients.length} clients

**YOUR CAPABILITIES:**
1. **Candidate Search & Filtering**: Find candidates based on skills, experience, location, availability, salary expectations, etc.
2. **Job Matching**: Match candidates to specific job orders or find candidates for job criteria
3. **Resume Analysis**: You have DIRECT ACCESS to resume files! When a candidate has a resume URL, I will fetch and provide you with the actual resume content. You can read, analyze, and extract detailed information from resumes including work history, achievements, education, certifications, and any other details. Use this information to provide comprehensive candidate assessments.
4. **Data Analysis**: Provide insights, rankings, comparisons, and recommendations
5. **Conversational**: Maintain context from previous messages in the conversation
6. **Specific Answers**: When listing candidates, always include their name, current role, experience, key skills, and resume availability

**IMPORTANT RULES:**
- When mentioning specific candidates, use their full name only (do NOT include IDs)
- When filtering/searching, provide specific candidate information (name, current role, experience, skills)
- If asked for a "top 5" or similar list, rank them and explain why
- Be conversational and helpful
- If criteria are vague, ask clarifying questions
- When matching candidates to jobs, consider: skills alignment, experience level, location, salary expectations, availability
- You can filter by any field: skills, experience, location, availability, status, etc.
- **Resume Access**: When a candidate has a resume URL, I will fetch the actual resume file and provide it to you. You can read the full resume content, analyze work history, extract achievements, review education, and provide detailed insights. When asked about resume content, I will automatically fetch and include the resume files for you to analyze.

**FORMATTING INSTRUCTIONS:**
- DO NOT use markdown formatting like **bold** or *italic*
- Use plain text with clear structure
- Use bullet points with dashes (-) or simple indentation
- Use line breaks to separate sections
- Keep formatting clean and readable without markdown syntax
- Use clear headings with colons (e.g., "Candidate Name:") instead of markdown headers

**CURRENT DATA:**

APPLICANTS:
${applicantsContext || "No applicants in database"}

JOB ORDERS:
${jobsContext || "No job orders in database"}

CLIENTS:
${clientsContext || "No clients in database"}

Now respond to the user's message. Be helpful, specific, and reference actual data from the database when possible.`

  try {
    // Check if user is asking about resumes - if so, fetch and include them
    const resumeKeywords = ["resume", "cv", "review resume", "read resume", "analyze resume", "resume content"]
    const isAskingAboutResumes = resumeKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    )

    // Find candidates mentioned in the message or get candidates with resumes
    const candidatesWithResumes = applicants.filter((app) => app.resume && app.resume.trim() !== "")
    
    // If asking about resumes, fetch them (limit to first 5 to avoid token limits)
    const resumeFiles: Array<{ base64: string; mimeType: string; candidateName: string; candidateId: string }> = []
    
    if (isAskingAboutResumes && candidatesWithResumes.length > 0) {
      console.log("[CHAT] User asking about resumes, fetching resume files...")
      const candidatesToFetch = candidatesWithResumes.slice(0, 5) // Limit to 5 resumes
      
      for (const candidate of candidatesToFetch) {
        const resumeData = await fetchResumeAsBase64(candidate.resume!)
        if (resumeData) {
          resumeFiles.push({
            ...resumeData,
            candidateName: candidate.fullName,
            candidateId: candidate.id,
          })
          console.log(`[CHAT] Fetched resume for ${candidate.fullName}`)
        }
      }
    }

    // Build messages array with resume files if available
    const messageContent: any[] = [
      {
        type: "text",
        text: conversationHistory.length === 0
          ? `${systemPrompt}\n\nUser: ${message}`
          : message,
      },
    ]

    // Add resume files to the message
    if (resumeFiles.length > 0) {
      for (const resumeFile of resumeFiles) {
        messageContent.push({
          type: "text",
          text: `\n\n[Resume for ${resumeFile.candidateName} (ID: ${resumeFile.candidateId})]`,
        })
        messageContent.push({
          type: "file",
          data: resumeFile.base64,
          mediaType: resumeFile.mimeType,
        })
      }
      messageContent.push({
        type: "text",
        text: "\n\nPlease analyze the resumes provided above and answer the user's question.",
      })
    }

    const messagesToSend = conversationHistory.length === 0
      ? [
          {
            role: "user" as const,
            content: messageContent.length === 1 ? messageContent[0].text : messageContent,
          },
        ]
      : [
          {
            role: "user" as const,
            content: systemPrompt,
          },
          ...conversationHistory.slice(-10), // Keep last 10 messages for context
          {
            role: "user" as const,
            content: messageContent.length === 1 ? messageContent[0].text : messageContent,
          },
        ]

    const { text } = await generateText({
      model: googleAI("gemini-2.0-flash"),
      messages: messagesToSend,
      temperature: 0.7,
      maxTokens: 2000,
    })

    console.log("[CHAT] Response generated successfully")

    return {
      success: true,
      message: text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[CHAT] Error:", errorMessage)

    return {
      success: false,
      error: `Failed to process message: ${errorMessage}`,
    }
  }
}

