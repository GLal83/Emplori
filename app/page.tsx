"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Pencil, Trash2, ArrowUpDown, Upload, DollarSign, Loader2, FileText, ExternalLink, Share2 } from "lucide-react"
import { storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

import { ProtectedRoute } from "@/components/protected-route"
import { UserProfile } from "@/components/user-profile"
import { ChatAssistant } from "@/components/chat-assistant"
import { useData } from "@/contexts/data-context"
import { parseResume } from "./actions/parse-resume"
import { analyzeApplicant } from "./actions/analyze-applicant"

type ApplicantStatus = "New" | "Screening" | "Submitted" | "Interview" | "Offer" | "Placed" | "Rejected"

interface Applicant {
  id: string
  fullName: string
  currentJobTitle: string
  currentCompany: string
  primarySkill: string
  totalYOE: number
  status: ApplicantStatus
  dateApplied: string
  source: string
  email: string
  phone: string
  linkedinUrl: string
  location: string
  availability: string
  desiredSalary: string
  secondarySkills: string[]
  resume: string // Now stores the download URL
  notes: string
  rating?: number // AI-generated rating (1-10)
}

export default function ApplicantDashboard() {
  const { applicants, addApplicant, updateApplicant, deleteApplicant, jobOrders } = useData()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<"fullName" | "totalYOE" | "dateApplied" | "rating" | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [skillInput, setSkillInput] = useState("")
  const [isParsingResume, setIsParsingResume] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingApplicant, setViewingApplicant] = useState<Applicant | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingRatings, setIsGeneratingRatings] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    currentJobTitle: "",
    currentCompany: "",
    primarySkill: "",
    totalYOE: "",
    status: "New" as ApplicantStatus,
    source: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    location: "",
    availability: "",
    desiredSalary: "",
    secondarySkills: [] as string[],
    resume: "", // Stores the download URL
    notes: "",
  })

  const handleSort = (field: "fullName" | "totalYOE" | "dateApplied" | "rating") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault()
      if (!formData.secondarySkills.includes(skillInput.trim())) {
        handleInputChange("secondarySkills", [...formData.secondarySkills, skillInput.trim()])
      }
      setSkillInput("")
    }
  }

  const handleRemoveSkill = (skill: string) => {
    handleInputChange(
      "secondarySkills",
      formData.secondarySkills.filter((s) => s !== skill),
    )
  }

  const handleEdit = (applicant: Applicant) => {
    handleOpenDialog("edit", applicant)
  }

  const resetForm = () => {
    setFormData({
      fullName: "",
      currentJobTitle: "",
      currentCompany: "",
      primarySkill: "",
      totalYOE: "",
      status: "New",
      source: "",
      email: "",
      phone: "",
      linkedinUrl: "",
      location: "",
      availability: "",
      desiredSalary: "",
      secondarySkills: [],
      resume: "",
      notes: "",
    })
    setEditMode(false)
    setSelectedApplicant(null)
  }

  // UPDATED handleResumeUpload - sends file directly to Gemini
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("[UPLOAD] Resume upload started for file:", file.name)
    console.log("[UPLOAD] File type:", file.type)
    console.log("[UPLOAD] File size:", (file.size / 1024).toFixed(2), "KB")
    
    setIsParsingResume(true)

    try {
      // Step 1: Upload to Firebase Storage
      console.log("[UPLOAD] Step 1: Uploading to Firebase Storage...")
      const storageRef = ref(storage, `resumes/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(storageRef)
      console.log("[UPLOAD] File uploaded successfully, URL:", downloadURL)

      handleInputChange("resume", downloadURL)

      // Step 2: Convert file to base64 for Gemini (browser-compatible)
      console.log("[UPLOAD] Step 2: Converting file to base64...")
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64String = result.split(',')[1]
          if (!base64String) {
            reject(new Error("Failed to convert file to base64"))
            return
          }
          resolve(base64String)
        }
        reader.onerror = (error) => {
          reject(new Error(`File reading error: ${error}`))
        }
        reader.readAsDataURL(file)
      })
      console.log("[UPLOAD] Conversion complete, base64 length:", base64.length)

      // Step 3: Send file DIRECTLY to Gemini
      console.log("[UPLOAD] Step 3: Sending file to Gemini...")
      const result = await parseResume(base64, file.type)
      console.log("[UPLOAD] Parse result:", result)

      if (result.success && result.data) {
        console.log("[UPLOAD] Step 4: Populating form...")
        
        setFormData((prev) => ({
          ...prev,
          resume: downloadURL,
          fullName: result.data.fullName || prev.fullName,
          email: result.data.email || prev.email,
          phone: result.data.phone || prev.phone,
          linkedinUrl: result.data.linkedinUrl || prev.linkedinUrl,
          currentJobTitle: result.data.currentJobTitle || prev.currentJobTitle,
          currentCompany: result.data.currentCompany || prev.currentCompany,
          location: result.data.location || prev.location,
          totalYOE: result.data.totalYOE?.toString() || prev.totalYOE,
          primarySkill: result.data.primarySkill || prev.primarySkill,
          secondarySkills: result.data.secondarySkills || prev.secondarySkills,
          desiredSalary: result.data.desiredSalary || prev.desiredSalary,
        }))

        const extractedFields = []
        if (result.data.fullName) extractedFields.push('Name')
        if (result.data.email) extractedFields.push('Email')
        if (result.data.phone) extractedFields.push('Phone')
        if (result.data.currentJobTitle) extractedFields.push('Job Title')
        if (result.data.totalYOE) extractedFields.push(`${result.data.totalYOE} Years Experience`)
        if (result.data.primarySkill) extractedFields.push('Primary Skill')
        if (result.data.secondarySkills?.length) extractedFields.push(`${result.data.secondarySkills.length} Skills`)

        alert(
          `✓ Resume parsed successfully!\n\n` +
          `Extracted: ${extractedFields.join(', ')}\n\n` +
          `Please complete:\n- Availability\n- Source`
        )
      } else {
        console.error("[UPLOAD] Parsing failed:", result.error)
        alert(`Resume uploaded but parsing failed: ${result.error}\n\nPlease fill manually.`)
      }
    } catch (error) {
      console.error("[UPLOAD] Error:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsParsingResume(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editMode && selectedApplicant) {
      await updateApplicant(selectedApplicant.id, {
        fullName: formData.fullName,
        currentJobTitle: formData.currentJobTitle,
        currentCompany: formData.currentCompany,
        primarySkill: formData.primarySkill,
        totalYOE: Number.parseInt(formData.totalYOE),
        status: formData.status,
        source: formData.source,
        email: formData.email,
        phone: formData.phone,
        linkedinUrl: formData.linkedinUrl,
        location: formData.location,
        availability: formData.availability,
        desiredSalary: formData.desiredSalary,
        secondarySkills: formData.secondarySkills,
        resume: formData.resume,
        notes: formData.notes,
      })
    } else {
      const newApplicant = {
        fullName: formData.fullName,
        currentJobTitle: formData.currentJobTitle,
        currentCompany: formData.currentCompany,
        primarySkill: formData.primarySkill,
        totalYOE: Number.parseInt(formData.totalYOE),
        status: formData.status,
        dateApplied: new Date().toISOString(),
        source: formData.source,
        email: formData.email,
        phone: formData.phone,
        linkedinUrl: formData.linkedinUrl,
        location: formData.location,
        availability: formData.availability,
        desiredSalary: formData.desiredSalary,
        secondarySkills: formData.secondarySkills,
        resume: formData.resume,
        notes: formData.notes,
      }
      
      await addApplicant(newApplicant)
      
      // Generate rating automatically for new applicants (in background)
      if (jobOrders.length > 0) {
        analyzeApplicant(
          {
            fullName: newApplicant.fullName,
            currentJobTitle: newApplicant.currentJobTitle,
            currentCompany: newApplicant.currentCompany,
            primarySkill: newApplicant.primarySkill,
            totalYOE: newApplicant.totalYOE,
            location: newApplicant.location,
            availability: newApplicant.availability,
            desiredSalary: newApplicant.desiredSalary,
            secondarySkills: newApplicant.secondarySkills,
            notes: newApplicant.notes,
            resume: newApplicant.resume, // Include resume URL for semantic analysis
          },
          jobOrders
        )
          .then((result) => {
            if (result.success && result.data?.overallRating) {
              // Find the newly added applicant and update with rating
              setTimeout(async () => {
                const latestApplicants = applicants.filter(
                  (a) => a.fullName === newApplicant.fullName && !a.rating
                )
                if (latestApplicants.length > 0) {
                  const latest = latestApplicants[latestApplicants.length - 1]
                  await updateApplicant(latest.id, { rating: result.data.overallRating })
                }
              }, 1000)
            }
          })
          .catch((error) => {
            console.error("Error generating rating for new applicant:", error)
          })
      }
    }

    handleCloseDialog()
  }

  const handleGenerateRatings = async () => {
    const applicantsWithoutRatings = applicants.filter((a) => !a.rating)
    
    if (applicantsWithoutRatings.length === 0) {
      alert("All applicants already have ratings!")
      return
    }

    if (!confirm(`Generate ratings for ${applicantsWithoutRatings.length} applicant(s)? This may take a few moments.`)) {
      return
    }

    setIsGeneratingRatings(true)
    
    try {
      for (const applicant of applicantsWithoutRatings) {
        try {
          const result = await analyzeApplicant(
            {
              fullName: applicant.fullName,
              currentJobTitle: applicant.currentJobTitle,
              currentCompany: applicant.currentCompany,
              primarySkill: applicant.primarySkill,
              totalYOE: applicant.totalYOE,
              location: applicant.location,
              availability: applicant.availability,
              desiredSalary: applicant.desiredSalary,
              secondarySkills: applicant.secondarySkills,
              notes: applicant.notes,
              resume: applicant.resume, // Include resume URL for semantic analysis
            },
            jobOrders
          )
          
          if (result.success && result.data?.overallRating) {
            await updateApplicant(applicant.id, { rating: result.data.overallRating })
          }
          
          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`Error generating rating for ${applicant.fullName}:`, error)
        }
      }
      
      alert(`Ratings generated for ${applicantsWithoutRatings.length} applicant(s)!`)
    } catch (error) {
      console.error("Error generating ratings:", error)
      alert("Error generating ratings. Please try again.")
    } finally {
      setIsGeneratingRatings(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this applicant?")) {
      await deleteApplicant(id)
    }
  }

  const filteredApplicants = applicants
    .filter((applicant) => {
      const matchesSearch =
        applicant.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.primarySkill.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.currentJobTitle.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || applicant.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (!sortField) return 0
      const direction = sortDirection === "asc" ? 1 : -1
      if (sortField === "fullName") {
        return a.fullName.localeCompare(b.fullName) * direction
      }
      if (sortField === "totalYOE") {
        return (a.totalYOE - b.totalYOE) * direction
      }
      if (sortField === "dateApplied") {
        return a.dateApplied.localeCompare(b.dateApplied) * direction
      }
      if (sortField === "rating") {
        const ratingA = a.rating ?? 0
        const ratingB = b.rating ?? 0
        return (ratingA - ratingB) * direction
      }
      return 0
    })

  const getStatusBadge = (status: ApplicantStatus) => {
    const variants: Record<ApplicantStatus, string> = {
      New: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      Screening: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Submitted: "bg-purple-100 text-purple-700 hover:bg-purple-100",
      Interview: "bg-orange-100 text-orange-700 hover:bg-orange-100",
      Offer: "bg-teal-100 text-teal-700 hover:bg-teal-100",
      Placed: "bg-green-100 text-green-700 hover:bg-green-100",
      Rejected: "bg-red-100 text-red-700 hover:bg-red-100",
    }
    return <Badge className={variants[status]}>{status}</Badge>
  }

  const handleOpenDialog = (mode: "add" | "edit", applicant?: Applicant) => {
    if (mode === "edit" && applicant) {
      setEditMode(true)
      setSelectedApplicant(applicant)
      setFormData({
        fullName: applicant.fullName,
        currentJobTitle: applicant.currentJobTitle,
        currentCompany: applicant.currentCompany,
        primarySkill: applicant.primarySkill,
        totalYOE: applicant.totalYOE.toString(),
        status: applicant.status,
        source: applicant.source,
        email: applicant.email,
        phone: applicant.phone,
        linkedinUrl: applicant.linkedinUrl,
        location: applicant.location,
        availability: applicant.availability,
        desiredSalary: applicant.desiredSalary,
        secondarySkills: applicant.secondarySkills,
        resume: applicant.resume,
        notes: applicant.notes,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setTimeout(() => resetForm(), 200)
  }

  const handleViewApplicant = async (applicant: Applicant) => {
    setViewingApplicant(applicant)
    setViewDialogOpen(true)
    setAnalysis(null) // Reset analysis
    
    // Trigger analysis
    setIsAnalyzing(true)
    try {
      const result = await analyzeApplicant(
        {
          fullName: applicant.fullName,
          currentJobTitle: applicant.currentJobTitle,
          currentCompany: applicant.currentCompany,
          primarySkill: applicant.primarySkill,
          totalYOE: applicant.totalYOE,
          location: applicant.location,
          availability: applicant.availability,
          desiredSalary: applicant.desiredSalary,
          secondarySkills: applicant.secondarySkills,
          notes: applicant.notes,
          resume: applicant.resume, // Include resume URL for semantic analysis
        },
        jobOrders
      )
      
      if (result.success && result.data) {
        setAnalysis(result.data)
        // Save rating to applicant record
        if (result.data.overallRating) {
          await updateApplicant(applicant.id, { rating: result.data.overallRating })
        }
      } else {
        console.error("Analysis failed:", result.error)
      }
    } catch (error) {
      console.error("Error analyzing applicant:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleShareResume = async (resumeUrl: string, applicantName: string) => {
    const shareData = {
      title: `${applicantName} - Resume`,
      text: `Resume for ${applicantName}`,
      url: resumeUrl,
    }

    // Check if Web Share API is available (mobile browsers, some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        // Success - native share dialog was shown and user completed sharing
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name !== "AbortError") {
          console.error("Error sharing:", error)
          // Fallback to copy if share fails
          await handleCopyResumeLink(resumeUrl)
        }
      }
    } else {
      // Fallback: Copy to clipboard for browsers that don't support Web Share API
      await handleCopyResumeLink(resumeUrl)
    }
  }

  const handleCopyResumeLink = async (resumeUrl: string) => {
    try {
      await navigator.clipboard.writeText(resumeUrl)
      alert("Resume link copied to clipboard!")
    } catch (error) {
      console.error("Failed to copy:", error)
      alert("Failed to copy link. Please copy manually.")
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
        <Image
                src="/images/design-mode/image.png"
                alt="Emplori Logo"
                width={200}
                height={60}
                className="h-12 w-auto"
              />
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">Welcome, Admin</span>
                <UserProfile />
              </div>
            </div>
            <nav className="flex gap-1 border-b border-slate-200 -mb-4">
              <Link href="/" className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Applicants
              </Link>
              <Link
                href="/jobs"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
              >
                Job Orders
              </Link>
              <Link
                href="/clients"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
              >
                Clients
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1400px] mx-auto px-6 py-8 pb-20">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Emplori Applicant Database</h1>
            <p className="text-slate-600">Manage and track all candidate applications</p>
          </div>

          {/* Control Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:max-w-md relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, skill, or job title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-200"
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-50">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Screening">Screening</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Interview">Interview</SelectItem>
                    <SelectItem value="Offer">Offer</SelectItem>
                    <SelectItem value="Placed">Placed</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    onClick={handleGenerateRatings}
                    disabled={isGeneratingRatings || applicants.filter((a) => !a.rating).length === 0}
                  >
                    {isGeneratingRatings ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      `Generate Ratings (${applicants.filter((a) => !a.rating).length})`
                    )}
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                        onClick={() => handleOpenDialog("add")}
                      >
                        + Add New Applicant
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-slate-900">
                        {editMode ? "Edit Applicant" : "Add New Applicant"}
                      </DialogTitle>
                      <DialogDescription className="text-slate-600">
                        {editMode
                          ? "Update the candidate's information"
                          : "Upload a resume to auto-fill the form, or enter information manually"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                      <div className="grid gap-6 py-4">
                        {!editMode && (
                          <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                              <Upload className="h-5 w-5 text-blue-600" />
                              Quick Add with Resume
                            </h3>
                            <div className="space-y-2">
                              <Label htmlFor="resume-upload" className="text-slate-700">
                                Upload Resume to Auto-Fill Form
                              </Label>
                              <div className="relative">
                                <label
                                  htmlFor="resume-upload"
                                  className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-white hover:bg-blue-50 transition-colors cursor-pointer block"
                                >
                                  {isParsingResume ? (
                                    <>
                                      <Loader2 className="h-10 w-10 text-blue-600 mx-auto mb-3 animate-spin" />
                                      <p className="text-sm text-slate-600 mb-1 font-medium">
                                        Uploading and parsing resume with AI...
                                      </p>
                                      <p className="text-xs text-slate-500">This may take a few seconds</p>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                                      <p className="text-sm text-slate-600 mb-1">
                                        <span className="text-blue-600 font-medium">Click to upload</span> or drag and
                                        drop
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        PDF, DOC, DOCX (max. 10MB) - AI will extract and save candidate info
                                      </p>
                                    </>
                                  )}
                                </label>
                                <Input
                                  id="resume-upload"
                                  type="file"
                                  accept=".pdf,.doc,.docx,.txt"
                                  className="hidden"
                                  onChange={handleResumeUpload}
                                  disabled={isParsingResume}
                                />
                              </div>
                              {formData.resume && (
                                <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                                  <span className="font-medium">✓ Resume uploaded and saved to cloud storage</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Core Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-slate-700">
                                  Full Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="fullName"
                                  placeholder="e.g., John Smith"
                                  value={formData.fullName}
                                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                                  required
                                  className="bg-slate-50"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="currentJobTitle" className="text-slate-700">
                                  Current Job Title <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="currentJobTitle"
                                  placeholder="e.g., Senior Software Engineer"
                                  value={formData.currentJobTitle}
                                  onChange={(e) => handleInputChange("currentJobTitle", e.target.value)}
                                  required
                                  className="bg-slate-50"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="currentCompany" className="text-slate-700">
                                  Current Company <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="currentCompany"
                                  placeholder="e.g., Tech Corp Inc."
                                  value={formData.currentCompany}
                                  onChange={(e) => handleInputChange("currentCompany", e.target.value)}
                                  required
                                  className="bg-slate-50"
                                />
                              </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700">
                                  Email <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="john.smith@example.com"
                                  value={formData.email}
                                  onChange={(e) => handleInputChange("email", e.target.value)}
                                  required
                                  className="bg-slate-50"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="phone" className="text-slate-700">
                                  Phone Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="phone"
                                  type="tel"
                                  placeholder="+1 (555) 123-4567"
                                  value={formData.phone}
                                  onChange={(e) => handleInputChange("phone", e.target.value)}
                                  required
                                  className="bg-slate-50"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="linkedinUrl" className="text-slate-700">
                                  LinkedIn Profile URL
                                </Label>
                                <Input
                                  id="linkedinUrl"
                                  type="url"
                                  placeholder="https://linkedin.com/in/..."
                                  value={formData.linkedinUrl}
                                  onChange={(e) => handleInputChange("linkedinUrl", e.target.value)}
                                  className="bg-slate-50"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
                            Location & Availability
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="location" className="text-slate-700">
                                Location (City, Province) <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="location"
                                placeholder="e.g., Toronto, ON"
                                value={formData.location}
                                onChange={(e) => handleInputChange("location", e.target.value)}
                                required
                                className="bg-slate-50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="availability" className="text-slate-700">
                                Availability <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={formData.availability}
                                onValueChange={(value) => handleInputChange("availability", value)}
                              >
                                <SelectTrigger id="availability" className="bg-slate-50">
                                  <SelectValue placeholder="Select availability" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Immediate">Immediate</SelectItem>
                                  <SelectItem value="2 Weeks">2 Weeks</SelectItem>
                                  <SelectItem value="1 Month">1 Month</SelectItem>
                                  <SelectItem value="2 Months">2 Months</SelectItem>
                                  <SelectItem value="3+ Months">3+ Months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="desiredSalary" className="text-slate-700">
                                Desired Salary / Rate
                              </Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <Input
                                  id="desiredSalary"
                                  placeholder="e.g., 120,000 or 75/hr"
                                  value={formData.desiredSalary}
                                  onChange={(e) => handleInputChange("desiredSalary", e.target.value)}
                                  className="bg-slate-50 pl-10"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Skills & Experience</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="totalYOE" className="text-slate-700">
                                Total Years of Experience <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="totalYOE"
                                type="number"
                                min="0"
                                placeholder="e.g., 5"
                                value={formData.totalYOE}
                                onChange={(e) => handleInputChange("totalYOE", e.target.value)}
                                required
                                className="bg-slate-50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="primarySkill" className="text-slate-700">
                                Primary Skill / Specialty <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="primarySkill"
                                placeholder="e.g., React/TypeScript"
                                value={formData.primarySkill}
                                onChange={(e) => handleInputChange("primarySkill", e.target.value)}
                                required
                                className="bg-slate-50"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="secondarySkills" className="text-slate-700">
                              Secondary Skills
                            </Label>
                            <Input
                              id="secondarySkills"
                              placeholder="Type a skill and press Enter"
                              value={skillInput}
                              onChange={(e) => setSkillInput(e.target.value)}
                              onKeyDown={handleAddSkill}
                              className="bg-slate-50"
                            />
                            {formData.secondarySkills.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {formData.secondarySkills.map((skill) => (
                                  <Badge
                                    key={skill}
                                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                                    onClick={() => handleRemoveSkill(skill)}
                                  >
                                    {skill} ×
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Press Enter to add skills. Click to remove.</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Recruitment Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="status" className="text-slate-700">
                                Status <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={formData.status}
                                onValueChange={(value) => handleInputChange("status", value)}
                              >
                                <SelectTrigger id="status" className="bg-slate-50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="New">New</SelectItem>
                                  <SelectItem value="Screening">Screening</SelectItem>
                                  <SelectItem value="Submitted">Submitted</SelectItem>
                                  <SelectItem value="Interview">Interview</SelectItem>
                                  <SelectItem value="Offer">Offer</SelectItem>
                                  <SelectItem value="Placed">Placed</SelectItem>
                                  <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="source" className="text-slate-700">
                                Source <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={formData.source}
                                onValueChange={(value) => handleInputChange("source", value)}
                              >
                                <SelectTrigger id="source" className="bg-slate-50">
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                                  <SelectItem value="Indeed">Indeed</SelectItem>
                                  <SelectItem value="Company Website">Company Website</SelectItem>
                                  <SelectItem value="Glassdoor">Glassdoor</SelectItem>
                                  <SelectItem value="Referral">Referral</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Documents & Notes</h3>
                          {editMode && (
                            <div className="space-y-2">
                              <Label htmlFor="resume-edit" className="text-slate-700">
                                Resume / CV (Upload new to replace)
                              </Label>
                              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                <label htmlFor="resume-edit" className="cursor-pointer block">
                                  <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                                  <p className="text-sm text-slate-600 mb-1">
                                    <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                                  </p>
                                  <p className="text-xs text-slate-500">PDF, DOC, DOCX (max. 10MB)</p>
                                </label>
                                <Input
                                  id="resume-edit"
                                  type="file"
                                  accept=".pdf,.doc,.docx,.txt"
                                  className="hidden"
                                  onChange={handleResumeUpload}
                                />
        </div>
                              {formData.resume && (
                                <p className="text-sm text-slate-600 mt-2">
                                  Current file:{" "}
          <a
                                    href={formData.resume}
            target="_blank"
            rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    View Resume
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="notes" className="text-slate-700">
                              Notes
                            </Label>
                            <Textarea
                              id="notes"
                              placeholder="Add any additional notes about this applicant..."
                              value={formData.notes}
                              onChange={(e) => handleInputChange("notes", e.target.value)}
                              className="bg-slate-50 min-h-[120px]"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCloseDialog}
                          className="border-slate-300 bg-transparent"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={isParsingResume}
                        >
                          {editMode ? "Update Applicant" : "Save Applicant"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">
                      <button
                        onClick={() => handleSort("fullName")}
                        className="flex items-center gap-2 hover:text-blue-600"
                      >
                        Full Name
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Current Job Title</TableHead>
                    <TableHead className="font-semibold text-slate-700">Primary Skill</TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <button
                        onClick={() => handleSort("totalYOE")}
                        className="flex items-center gap-2 hover:text-blue-600"
                      >
                        Total YOE
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <button
                        onClick={() => handleSort("rating")}
                        className="flex items-center gap-2 hover:text-blue-600"
                      >
                        Rating
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <button
                        onClick={() => handleSort("dateApplied")}
                        className="flex items-center gap-2 hover:text-blue-600"
                      >
                        Date Applied
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Source</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Resume</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplicants.map((applicant) => (
                    <TableRow key={applicant.id} className="hover:bg-blue-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleViewApplicant(applicant)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {applicant.fullName}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-700">{applicant.currentJobTitle}</TableCell>
                      <TableCell className="text-slate-700">{applicant.primarySkill}</TableCell>
                      <TableCell className="text-slate-700">{applicant.totalYOE} years</TableCell>
                      <TableCell>{getStatusBadge(applicant.status)}</TableCell>
                      <TableCell>
                        {applicant.rating ? (
                          <Badge
                            className={`font-semibold ${
                              applicant.rating >= 8
                                ? "bg-green-100 text-green-700"
                                : applicant.rating >= 6
                                ? "bg-blue-100 text-blue-700"
                                : applicant.rating >= 4
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {applicant.rating}/10
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {new Date(applicant.dateApplied).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-slate-700">{applicant.source}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {applicant.resume ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(applicant.resume, "_blank", "noopener,noreferrer")
                                }}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Open resume in new tab"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleShareResume(applicant.resume, applicant.fullName)
                                }}
                                className="h-8 w-8 text-slate-600 hover:text-green-600 hover:bg-green-50"
                                title="Share resume"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">No resume</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(applicant)
                            }}
                            className="h-8 w-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(applicant.id)
                            }}
                            className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-slate-600">
            Showing {filteredApplicants.length} of {applicants.length} applicants
          </div>
        </main>

        {/* View Applicant Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {viewingApplicant?.fullName}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Applicant Details & Resume
              </DialogDescription>
            </DialogHeader>
            {viewingApplicant && (
              <div className="space-y-6 py-4">
                {/* AI Analysis Section */}
                {isAnalyzing ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      <p className="text-blue-700 font-medium">Analyzing candidate with AI...</p>
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">AI Candidate Analysis</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Overall Rating:</span>
                        <Badge className={`text-lg font-bold px-3 py-1 ${
                          analysis.overallRating >= 8
                            ? "bg-green-100 text-green-700"
                            : analysis.overallRating >= 6
                            ? "bg-blue-100 text-blue-700"
                            : analysis.overallRating >= 4
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {analysis.overallRating}/10
                        </Badge>
                      </div>
                    </div>
                    
                    {analysis.summary && (
                      <div>
                        <Label className="text-sm font-semibold text-slate-700">Summary</Label>
                        <p className="mt-1 text-slate-700">{analysis.summary}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.pros && analysis.pros.length > 0 && (
                        <div>
                          <Label className="text-sm font-semibold text-green-700">Pros</Label>
                          <ul className="mt-2 space-y-1">
                            {analysis.pros.map((pro: string, index: number) => (
                              <li key={index} className="text-slate-700 flex items-start gap-2">
                                <span className="text-green-600 mt-1">✓</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {analysis.potentialDiscussionPoints && analysis.potentialDiscussionPoints.length > 0 && (
                        <div>
                          <Label className="text-sm font-semibold text-blue-700">Potential Discussion Points</Label>
                          <ul className="mt-2 space-y-1">
                            {analysis.potentialDiscussionPoints.map((point: string, index: number) => (
                              <li key={index} className="text-slate-700 flex items-start gap-2">
                                <span className="text-blue-600 mt-1">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {analysis.jobMatches && analysis.jobMatches.length > 0 && (
                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">Job Matches</Label>
                        <div className="space-y-3">
                          {analysis.jobMatches.map((match: any) => {
                            const job = jobOrders.find((j) => j.id === match.jobId)
                            return (
                              <div
                                key={match.jobId}
                                className="bg-white border border-slate-200 rounded-lg p-4 space-y-2"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900">{match.jobTitle}</h4>
                                    {job && (
                                      <p className="text-sm text-slate-600">{job.clientCompany}</p>
                                    )}
                                  </div>
                                  <Badge
                                    className={`${
                                      match.matchScore >= 80
                                        ? "bg-green-100 text-green-700"
                                        : match.matchScore >= 60
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    }`}
                                  >
                                    {match.matchScore}% Match
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-700">
                                  <span className="font-medium">Why:</span> {match.matchReason}
                                </p>
                                {match.concerns && (
                                  <p className="text-sm text-orange-700">
                                    <span className="font-medium">Note:</span> {match.concerns}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                
                {/* Applicant Information */}
                <div className="space-y-6">
                  {/* Contact & Basic Info */}
                  <div className="bg-white border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Contact Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.email || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.phone || "N/A"}</p>
                      </div>
                      {viewingApplicant.linkedinUrl && (
                        <div>
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">LinkedIn</Label>
                          <p className="mt-1">
                            <a
                              href={viewingApplicant.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium flex items-center gap-1"
                            >
                              View Profile
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.location || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Professional Details */}
                  <div className="bg-white border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Professional Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Position</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.currentJobTitle || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Company</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.currentCompany || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Years of Experience</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.totalYOE} years</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Primary Skill</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.primarySkill || "N/A"}</p>
                      </div>
                      {viewingApplicant.secondarySkills && viewingApplicant.secondarySkills.length > 0 && (
                        <div className="md:col-span-2">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Skills</Label>
                          <div className="flex flex-wrap gap-2">
                            {viewingApplicant.secondarySkills.map((skill) => (
                              <Badge key={skill} className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recruitment Details */}
                  <div className="bg-white border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Recruitment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</Label>
                        <div className="mt-1">{getStatusBadge(viewingApplicant.status)}</div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Source</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.source || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date Applied</Label>
                        <p className="mt-1 text-slate-900 font-medium">
                          {new Date(viewingApplicant.dateApplied).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Availability</Label>
                        <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.availability || "N/A"}</p>
                      </div>
                      {viewingApplicant.desiredSalary && (
                        <div>
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Desired Salary</Label>
                          <p className="mt-1 text-slate-900 font-medium">{viewingApplicant.desiredSalary}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewingApplicant.notes && (
                    <div className="bg-white border border-slate-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Notes</h3>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{viewingApplicant.notes}</p>
                    </div>
                  )}
                </div>
        </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setViewDialogOpen(false)
                  setViewingApplicant(null)
                }}
              >
                Close
              </Button>
              {viewingApplicant && (
                <Button
                  onClick={() => {
                    setViewDialogOpen(false)
                    handleEdit(viewingApplicant)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Edit Applicant
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Chat Assistant */}
        <ChatAssistant />
    </div>
    </ProtectedRoute>
  )
}