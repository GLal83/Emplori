"use client"
import { useState } from "react"
import type React from "react"
import { useData } from "@/contexts/data-context"
import { useUserRole } from "@/hooks/use-user-role"
import { useAuth } from "@/components/auth-provider"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Pencil, Trash2, Upload, X } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { UserProfile } from "@/components/user-profile"

type JobStatus = "Open" | "Interviewing" | "On Hold" | "Placed" | "Canceled"
type JobPriority = "High" | "Medium" | "Low"

interface JobOrder {
  id: string
  jobTitle: string
  clientCompany: string
  hiringManager: string
  status: JobStatus
  priority: JobPriority
  salaryRange: string
  feeType: string
  dateOpened: string
  notes?: string
  createdBy?: string
}

export default function JobOrdersDashboard() {
  const { clients, jobOrders, addJobOrder, updateJobOrder, deleteJobOrder } = useData()
  const { isAdmin, userEmail } = useUserRole()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobOrder | null>(null)
  const [formData, setFormData] = useState({
    clientCompany: "",
    jobTitle: "",
    hiringManager: "",
    status: "Open" as JobStatus,
    priority: "Medium" as JobPriority,
    salaryRange: "",
    feeType: "",
    notes: "",
  })
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [availableManagers, setAvailableManagers] = useState<string[]>([])

  const filteredJobOrders = jobOrders.filter((job) => {
    const matchesSearch =
      job.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clientCompany.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    const matchesPriority = priorityFilter === "all" || job.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const filteredClients = clients.filter((client) =>
    client.companyName.toLowerCase().includes(clientSearchQuery.toLowerCase()),
  )

  const handleClientSelect = (clientName: string) => {
    const client = clients.find((c) => c.companyName === clientName)
    setFormData({ ...formData, clientCompany: clientName, hiringManager: "" })
    setClientSearchQuery(clientName)
    setAvailableManagers(client?.managers || [])
    setShowClientDropdown(false)
  }

  const handleOpenDialog = (job?: JobOrder) => {
    if (job) {
      setEditingJob(job)
      setFormData({
        clientCompany: job.clientCompany,
        jobTitle: job.jobTitle,
        hiringManager: job.hiringManager,
        status: job.status,
        priority: job.priority,
        salaryRange: job.salaryRange,
        feeType: job.feeType,
        notes: job.notes || "",
      })
      setClientSearchQuery(job.clientCompany)
      const client = clients.find((c) => c.companyName === job.clientCompany)
      setAvailableManagers(client?.managers || [])
    } else {
      setEditingJob(null)
      setFormData({
        clientCompany: "",
        jobTitle: "",
        hiringManager: "",
        status: "Open",
        priority: "Medium",
        salaryRange: "",
        feeType: "",
        notes: "",
      })
      setClientSearchQuery("")
      setAvailableManagers([])
      setUploadedFile(null)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check permissions for editing
    if (editingJob) {
      // Recruiters can only edit their own jobs
      if (!isAdmin && editingJob.createdBy !== userEmail) {
        alert("You don't have permission to edit this job order. You can only edit jobs you created.")
        return
      }

      await updateJobOrder(editingJob.id, {
        clientCompany: formData.clientCompany,
        jobTitle: formData.jobTitle,
        hiringManager: formData.hiringManager,
        status: formData.status,
        priority: formData.priority,
        salaryRange: formData.salaryRange,
        feeType: formData.feeType,
        notes: formData.notes,
      })
    } else {
      // New job - set creator
      await addJobOrder({
        clientCompany: formData.clientCompany,
        jobTitle: formData.jobTitle,
        hiringManager: formData.hiringManager,
        status: formData.status,
        priority: formData.priority,
        salaryRange: formData.salaryRange,
        feeType: formData.feeType,
        dateOpened: new Date().toISOString(),
        notes: formData.notes,
        createdBy: userEmail || user?.email || undefined,
      })
    }

    setIsDialogOpen(false)
  }

  const handleDelete = async (id: string, job: JobOrder) => {
    // Check permissions
    if (!isAdmin && job.createdBy !== userEmail) {
      alert("You don't have permission to delete this job order. You can only delete jobs you created.")
      return
    }

    if (confirm("Are you sure you want to delete this job order?")) {
      await deleteJobOrder(id)
    }
  }

  // Check if user can edit/delete a job
  const canModifyJob = (job: JobOrder) => {
    return isAdmin || job.createdBy === userEmail
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const getStatusBadge = (status: JobStatus) => {
    const variants: Record<JobStatus, string> = {
      Open: "bg-green-100 text-green-700 hover:bg-green-100",
      Interviewing: "bg-blue-100 text-blue-700 hover:bg-blue-100",
      "On Hold": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      Placed: "bg-purple-100 text-purple-700 hover:bg-purple-100",
      Canceled: "bg-red-100 text-red-700 hover:bg-red-100",
    }
    return <Badge className={variants[status]}>{status}</Badge>
  }

  const getPriorityColor = (priority: JobPriority) => {
    const colors: Record<JobPriority, string> = {
      High: "text-red-600 font-semibold",
      Medium: "text-orange-600 font-medium",
      Low: "text-slate-500",
    }
    return colors[priority]
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
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
              >
                Applicants
              </Link>
              <Link href="/jobs" className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
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
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Active Job Orders</h1>
            <p className="text-slate-600">Manage client job postings and track recruitment progress</p>
          </div>

          {/* Control Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:max-w-md relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by Job Title or Client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-200"
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-50">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Interviewing">Interviewing</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Placed">Placed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-50">
                    <SelectValue placeholder="Filter by Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleOpenDialog()}
                  className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                >
                  + Add New Job Order
                </Button>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">Job Title</TableHead>
                    <TableHead className="font-semibold text-slate-700">Client Company</TableHead>
                    <TableHead className="font-semibold text-slate-700">Hiring Manager</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Priority</TableHead>
                    <TableHead className="font-semibold text-slate-700">Salary Range</TableHead>
                    <TableHead className="font-semibold text-slate-700">Date Opened</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobOrders.map((job) => (
                    <TableRow key={job.id} className="hover:bg-blue-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline">
                          {job.jobTitle}
                        </a>
                      </TableCell>
                      <TableCell className="text-slate-700">{job.clientCompany}</TableCell>
                      <TableCell className="text-slate-700">{job.hiringManager}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        <span className={getPriorityColor(job.priority)}>{job.priority}</span>
                      </TableCell>
                      <TableCell className="text-slate-700">{job.salaryRange}</TableCell>
                      <TableCell className="text-slate-700">
                        {new Date(job.dateOpened).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {canModifyJob(job) ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => handleOpenDialog(job)}
                                title="Edit job order"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(job.id, job)}
                                className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"
                                title="Delete job order"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Read-only</span>
                          )}
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
            Showing {filteredJobOrders.length} of {jobOrders.length} job orders
          </div>
        </main>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {editingJob ? "Edit Job Order" : "Add New Job Order"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              {/* Job Details Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Job Details</h3>
                <div className="space-y-4">
                  {/* Client Company - Searchable Dropdown */}
                  <div className="relative">
                    <Label htmlFor="clientCompany" className="text-slate-700 font-medium">
                      Client Company <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="clientCompany"
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value)
                          setShowClientDropdown(true)
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search for a client company..."
                        className="mt-1"
                        required
                      />
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              onClick={() => handleClientSelect(client.companyName)}
                            >
                              {client.companyName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Job Title */}
                  <div>
                    <Label htmlFor="jobTitle" className="text-slate-700 font-medium">
                      Job Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="jobTitle"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      placeholder="e.g., Senior Software Engineer"
                      className="mt-1"
                      required
                    />
                  </div>

                  {/* Hiring Manager */}
                  <div>
                    <Label htmlFor="hiringManager" className="text-slate-700 font-medium">
                      Hiring Manager <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.hiringManager}
                      onValueChange={(value) => setFormData({ ...formData, hiringManager: value })}
                      disabled={!formData.clientCompany}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue
                          placeholder={
                            formData.clientCompany ? "Select hiring manager..." : "Select client company first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableManagers.map((manager) => (
                          <SelectItem key={manager} value={manager}>
                            {manager}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Status & Priority Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Status & Priority</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status" className="text-slate-700 font-medium">
                      Status <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: JobStatus) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Interviewing">Interviewing</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Placed">Placed</SelectItem>
                        <SelectItem value="Canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority" className="text-slate-700 font-medium">
                      Priority <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: JobPriority) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Compensation & Terms Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Compensation & Terms</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salaryRange" className="text-slate-700 font-medium">
                      Salary Range <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="salaryRange"
                      value={formData.salaryRange}
                      onChange={(e) => setFormData({ ...formData, salaryRange: e.target.value })}
                      placeholder="e.g., $90k - $110k"
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="feeType" className="text-slate-700 font-medium">
                      Fee % / Type <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="feeType"
                      value={formData.feeType}
                      onChange={(e) => setFormData({ ...formData, feeType: e.target.value })}
                      placeholder="e.g., 20% Contingent"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documents & Notes Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">Documents & Notes</h3>
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <Label className="text-slate-700 font-medium">Job Description / Spec Sheet</Label>
                    <div className="mt-1">
                      {!uploadedFile ? (
                        <label
                          htmlFor="fileUpload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                        >
                          <Upload className="h-8 w-8 text-slate-400 mb-2" />
                          <span className="text-sm text-slate-600">Click to upload or drag and drop</span>
                          <span className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX (Max 10MB)</span>
                          <input
                            id="fileUpload"
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Upload className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{uploadedFile.name}</p>
                              <p className="text-xs text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-red-600"
                            onClick={() => setUploadedFile(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-slate-700 font-medium">
                      Key Requirements / Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add key requirements, special instructions, or any other notes about this job order..."
                      className="mt-1 min-h-[120px] resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingJob ? "Update Job Order" : "Save Job Order"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
