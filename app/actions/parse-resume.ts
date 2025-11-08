// parse-resume.ts
"use server"

import { generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

// --- CLEAN SCHEMA (only fields that actually appear on resumes) ---
const resumeSchema = z.object({
  fullName: z.string().optional().nullable().describe("The candidate's full name"),
  email: z.union([z.string().email(), z.null()]).optional().describe("The candidate's email address"),
  phone: z.string().optional().nullable().describe("The candidate's phone number"),
  linkedinUrl: z.string().optional().nullable().describe("The candidate's LinkedIn profile URL"),
  currentJobTitle: z.string().optional().nullable().describe("The candidate's current or most recent job title"),
  currentCompany: z.string().optional().nullable().describe("The candidate's current or most recent company"),
  location: z.string().optional().nullable().describe("The candidate's location (city, province/state)"),
  totalYOE: z.number().optional().nullable().describe("Total years of professional experience calculated from work history"),
  primarySkill: z.string().optional().nullable().describe("The candidate's primary skill or specialty area"),
  secondarySkills: z.union([z.array(z.string()), z.null()]).optional().describe("Additional skills and technologies (return as array, limit to 10 most relevant)"),
  desiredSalary: z.string().optional().nullable().describe("Desired salary or hourly rate if mentioned"),
})

// Initialize the Google AI client
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
})

/**
 * Parse a resume file directly using Gemini's native file understanding
 * Supports PDF, DOCX, and text files - Gemini can read them all!
 * 
 * @param fileBase64 - The file as base64 string
 * @param mimeType - MIME type of the file (e.g., 'application/pdf')
 */
export async function parseResume(fileBase64: string, mimeType: string) {
  console.log("[PARSER] Starting resume parsing...")
  console.log("[PARSER] File type:", mimeType)
  console.log("[PARSER] Base64 length:", fileBase64?.length || 0)
  console.log("[PARSER] API Key exists:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY)

  // Input validation
  if (!fileBase64 || fileBase64.trim().length === 0) {
    return {
      success: false,
      error: "File data is empty. Please ensure the file was uploaded correctly.",
    }
  }

  // --- ENHANCED PROMPT WITH SPECIFIC INSTRUCTIONS ---
  const PROMPT = `
You are an expert AI recruitment assistant for EMPLORI RECRUITING SERVICES, specializing in Canadian recruitment.

Your task is to extract structured candidate information from the resume file provided.

**CRITICAL INSTRUCTIONS:**

1. **Full Name**: Extract the candidate's complete name (usually at the top of the resume)

2. **Contact Information**:
   - Email: Extract email address
   - Phone: Extract phone number (keep original format)
   - LinkedIn URL: Extract LinkedIn profile URL if present

3. **Current Position**:
   - Current Job Title: The MOST RECENT job title from work history
   - Current Company: The MOST RECENT company from work history
   - Location: City and province/state (e.g., "Toronto, ON" or "San Francisco, CA")

4. **TOTAL YEARS OF EXPERIENCE** (CRITICAL - DO NOT LEAVE THIS NULL):
   - **Method 1**: If the resume explicitly states "X years of experience", use that number
   - **Method 2**: Calculate from work history by:
     a. Identify each job's start and end dates
     b. Calculate the duration of each position in years (including decimals)
     c. Sum all durations (count overlapping positions only once)
     d. If "Present" or "Current", calculate to November 2025
   - **Method 3**: If dates are vague (e.g., "2020-2022"), estimate as: 2022-2020 = 2 years
   - **Method 4**: If only years are given (no months), subtract years: end_year - start_year
   - **Return as a number** (e.g., 5, 7.5, 12, 3.5)
   - **IMPORTANT**: Make your best effort to calculate this. Do NOT return null unless there is absolutely zero work history.

5. **Skills**:
   - Primary Skill: The MAIN technology, domain, or expertise area
     Examples: "Full-Stack Development", "Data Engineering", "React Development", "DevOps", "Product Management"
   - Secondary Skills: Array of relevant skills, technologies, frameworks, tools (max 10, most relevant first)
   - Extract from: Skills section, job descriptions, technologies mentioned, tools used
   - Prioritize: Programming languages, frameworks, cloud platforms, tools, methodologies

6. **Desired Salary**: Only extract if explicitly mentioned (e.g., "$120,000", "$75/hour", "120k")

**CALCULATION EXAMPLES:**

Example 1:
- Software Engineer | ABC Corp | Jan 2020 - Present
- Junior Developer | XYZ Inc | Jun 2018 - Dec 2019
Calculation: (Nov 2025 - Jan 2020) + (Dec 2019 - Jun 2018) = 5.83 + 1.5 = 7.33 years
Return: 7.3 or 7

Example 2:
- Senior Analyst | Company A | 2022 - Present  
- Analyst | Company B | 2019 - 2022
- Intern | Company C | 2018 - 2019
Calculation: (2025 - 2022) + (2022 - 2019) + (2019 - 2018) = 3 + 3 + 1 = 7 years
Return: 7

Example 3:
Resume states: "Software engineer with 10 years of experience"
Return: 10

**VALIDATION RULES:**
- If a field is not found in the resume, use \`null\`
- Do not fabricate or guess information
- Do not include explanations or reasoning in the output, just return the structured data
- For secondarySkills, return \`null\` if no skills found, or an array with up to 10 skills if they exist
- For totalYOE, you MUST make a calculation attempt - do not return null unless absolutely no work history exists
- Read the ENTIRE resume carefully before making calculations

Now extract the information from the resume file following the exact schema provided.
`

  try {
    const { object } = await generateObject({
      model: googleAI("gemini-2.0-flash"),
      schema: resumeSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PROMPT,
            },
            {
              type: "file",
              data: fileBase64,
              mediaType: mimeType,
            },
          ],
        },
      ],
    })

    console.log("[PARSER] Resume parsed successfully:", JSON.stringify(object, null, 2))
    
    // Post-processing validation and warnings
    const warnings = []
    
    if (!object.fullName && !object.email) {
      warnings.push("Neither name nor email found - parsing may have failed")
      console.warn("[PARSER] Warning:", warnings[warnings.length - 1])
    }
    
    if (object.totalYOE === null || object.totalYOE === undefined) {
      warnings.push("Total years of experience not extracted - work history may be unclear")
      console.warn("[PARSER] Warning:", warnings[warnings.length - 1])
    }
    
    if (!object.currentJobTitle) {
      warnings.push("Current job title not found")
      console.warn("[PARSER] Warning:", warnings[warnings.length - 1])
    }

    return { 
      success: true, 
      data: object,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("[PARSER] Resume parsing error details:", {
      message: errorMessage,
      stack: errorStack,
      error: error,
      mimeType: mimeType,
      base64Length: fileBase64?.length || 0,
      apiKeyExists: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })

    // Provide helpful error messages
    let userFriendlyError = "Failed to parse resume"
    
    if (errorMessage.includes("schema")) {
      userFriendlyError = "Failed to parse resume: The AI couldn't extract information in the expected format. Please try uploading a different format or fill in the information manually."
    } else if (errorMessage.includes("API") || errorMessage.includes("key")) {
      userFriendlyError = "Failed to parse resume: API configuration error. Please contact support."
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      userFriendlyError = "Failed to parse resume: API rate limit reached. Please try again in a moment."
    } else if (errorMessage.includes("file") || errorMessage.includes("MIME")) {
      userFriendlyError = "Failed to parse resume: File format not supported. Please ensure you're uploading a PDF, DOCX, or TXT file."
    } else {
      userFriendlyError = `Failed to parse resume: ${errorMessage}`
    }

    return {
      success: false,
      error: userFriendlyError,
    }
  }
}