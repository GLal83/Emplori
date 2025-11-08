"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Search, Pencil, User, Briefcase, MapPin, Check, ChevronsUpDown, Upload, Building2, Trash2 } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { UserProfile } from "@/components/user-profile"
import { useData } from "@/contexts/data-context"
import { useUserRole } from "@/hooks/use-user-role"
import { useAuth } from "@/components/auth-provider"

type ClientStatus = "Active Client" | "Prospect" | "Past Client" | "Do Not Contact"

interface Client {
  id: string
  companyName: string
  industry: string
  website: string
  status: ClientStatus
  location: string
  feeAgreement: string
  notes: string
  openJobs: number
  totalContacts: number
  keyContact: string
  logo?: string
  managers?: string[]
  createdBy?: string
}

export default function ClientsDashboard() {
  const { clients, addClient, updateClient, deleteClient } = useData()
  const { isAdmin, userEmail } = useUserRole()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const [contactFormData, setContactFormData] = useState({
    fullName: "",
    clientCompany: "",
    jobTitle: "",
    email: "",
    phone: "",
    linkedIn: "",
    notes: "",
  })

  const [companySearchQuery, setCompanySearchQuery] = useState("")
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false)

  const [clientFormData, setClientFormData] = useState({
    companyName: "",
    industry: "",
    website: "",
    status: "Prospect" as ClientStatus,
    location: "",
    feeAgreement: "",
    notes: "",
    logo: "",
  })

  const [logoPreview, setLogoPreview] = useState<string>("")

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.industry.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleOpenClientDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client)
      setClientFormData({
        companyName: client.companyName,
        industry: client.industry,
        website: client.website,
        status: client.status,
        location: client.location,
        feeAgreement: client.feeAgreement,
        notes: client.notes,
        logo: client.logo || "",
      })
      setLogoPreview(client.logo || "")
    } else {
      setEditingClient(null)
      setClientFormData({
        companyName: "",
        industry: "",
        website: "",
        status: "Prospect",
        location: "",
        feeAgreement: "",
        notes: "",
        logo: "",
      })
      setLogoPreview("")
    }
    setIsClientDialogOpen(true)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setLogoPreview(result)
        setClientFormData({ ...clientFormData, logo: result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingClient) {
      // Check permissions for editing
      if (!isAdmin && editingClient.createdBy !== userEmail) {
        alert("You don't have permission to edit this client. You can only edit clients you created.")
        return
      }

      await updateClient(editingClient.id, {
        ...clientFormData,
        managers: editingClient.managers || [],
        openJobs: editingClient.openJobs,
        totalContacts: editingClient.totalContacts,
        keyContact: editingClient.keyContact,
      })
    } else {
      // New client - set creator
      await addClient({
        ...clientFormData,
        managers: [],
        openJobs: 0,
        totalContacts: 0,
        keyContact: "No contact yet",
        createdBy: userEmail || user?.email || undefined,
      })
    }

    setIsClientDialogOpen(false)
    setClientFormData({
      companyName: "",
      industry: "",
      website: "",
      status: "Prospect",
      location: "",
      feeAgreement: "",
      notes: "",
      logo: "",
    })
    setLogoPreview("")
  }

  const handleDeleteClient = async (client: Client) => {
    // Check permissions
    if (!isAdmin && client.createdBy !== userEmail) {
      alert("You don't have permission to delete this client. You can only delete clients you created.")
      return
    }

    if (confirm(`Are you sure you want to delete ${client.companyName}?`)) {
      await deleteClient(client.id)
    }
  }

  // Check if user can edit/delete a client
  const canModifyClient = (client: Client) => {
    return isAdmin || client.createdBy === userEmail
  }

  const handleOpenContactDialog = () => {
    setContactFormData({
      fullName: "",
      clientCompany: "",
      jobTitle: "",
      email: "",
      phone: "",
      linkedIn: "",
      notes: "",
    })
    setCompanySearchQuery("")
    setIsContactDialogOpen(true)
  }

  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Contact submitted:", contactFormData)
    setIsContactDialogOpen(false)
  }

  const filteredCompaniesForDropdown = clients.filter((client) =>
    client.companyName.toLowerCase().includes(companySearchQuery.toLowerCase()),
  )

  const handleSelectCompany = (companyName: string) => {
    setContactFormData({ ...contactFormData, clientCompany: companyName })
    setCompanySearchQuery(companyName)
    setIsCompanyDropdownOpen(false)
  }

  const getStatusBadge = (status: ClientStatus) => {
    const variants: Record<ClientStatus, string> = {
      "Active Client": "bg-green-100 text-green-700 hover:bg-green-100",
      Prospect: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      "Past Client": "bg-slate-100 text-slate-700 hover:bg-slate-100",
      "Do Not Contact": "bg-red-100 text-red-700 hover:bg-red-100",
    }
    return <Badge className={variants[status]}>{status}</Badge>
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
              <Link
                href="/jobs"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
              >
                Job Orders
              </Link>
              <Link href="/clients" className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Clients
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Emplori Client Database</h1>
            <p className="text-slate-600">Manage your client companies and relationships</p>
          </div>

          {/* Control Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:max-w-md relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by company name or industry..."
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
                    <SelectItem value="Active Client">Active Client</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                    <SelectItem value="Past Client">Past Client</SelectItem>
                    <SelectItem value="Do Not Contact">Do Not Contact</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleOpenContactDialog}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                >
                  + Add New Contact
                </Button>
                <Button onClick={() => handleOpenClientDialog()} className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Add New Client (Company)
                </Button>
              </div>
            </div>
          </div>

          {/* Client Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 relative"
              >
                {/* Edit Button */}
                {canModifyClient(client) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 text-slate-400 hover:text-blue-600"
                    onClick={() => handleOpenClientDialog(client)}
                    title="Edit client"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}

                <div className="flex items-start gap-4 mb-3">
                  <div className="flex-shrink-0">
                    {client.logo ? (
                      <Image
                        src={client.logo || "/placeholder.svg"}
                        alt={`${client.companyName} logo`}
                        width={60}
                        height={60}
                        className="rounded-lg object-contain border border-slate-200"
                      />
                    ) : (
                      <div className="w-[60px] h-[60px] rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Building2 className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 pr-8 mb-2 break-words">{client.companyName}</h3>
                    {getStatusBadge(client.status)}
                  </div>
                </div>

                {/* Company Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span>Industry: {client.industry}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{client.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>Contact: {client.keyContact}</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">{client.openJobs}</span>
                    <span className="text-sm text-slate-600">Open Jobs</span>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900">{client.totalContacts}</span>
                    <span className="text-sm text-slate-600">Total Contacts</span>
                  </div>
                </div>

                {canModifyClient(client) && (
                  <div className="pt-4 border-t border-slate-200 mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteClient(client)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Client
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Results Count */}
          <div className="mt-6 text-sm text-slate-600">
            Showing {filteredClients.length} of {clients.length} clients
          </div>
        </main>

        {/* Add/Edit Client Dialog */}
        <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmitClient} className="space-y-6 mt-4">
              <div>
                <Label className="text-slate-700 font-medium">Company Logo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <Image
                        src={logoPreview || "/placeholder.svg"}
                        alt="Company logo preview"
                        width={80}
                        height={80}
                        className="rounded-lg object-contain border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-[80px] h-[80px] rounded-lg bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                        <Building2 className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Input id="logo" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <Label
                      htmlFor="logo"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer border border-slate-200 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Logo
                    </Label>
                    <p className="text-xs text-slate-500 mt-2">Recommended: Square image, PNG or JPG, max 2MB</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName" className="text-slate-700 font-medium">
                      Client Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={clientFormData.companyName}
                      onChange={(e) => setClientFormData({ ...clientFormData, companyName: e.target.value })}
                      placeholder="e.g., Acme Corporation"
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="industry" className="text-slate-700 font-medium">
                      Industry <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="industry"
                      value={clientFormData.industry}
                      onChange={(e) => setClientFormData({ ...clientFormData, industry: e.target.value })}
                      placeholder="e.g., Technology"
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="website" className="text-slate-700 font-medium">
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={clientFormData.website}
                      onChange={(e) => setClientFormData({ ...clientFormData, website: e.target.value })}
                      placeholder="e.g., www.example.com"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status" className="text-slate-700 font-medium">
                      Status <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={clientFormData.status}
                      onValueChange={(value: ClientStatus) => setClientFormData({ ...clientFormData, status: value })}
                    >
                      <SelectTrigger id="status" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prospect">Prospect</SelectItem>
                        <SelectItem value="Active Client">Active Client</SelectItem>
                        <SelectItem value="Past Client">Past Client</SelectItem>
                        <SelectItem value="Do Not Contact">Do Not Contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-slate-700 font-medium">
                      Location (Main Office) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="location"
                      value={clientFormData.location}
                      onChange={(e) => setClientFormData({ ...clientFormData, location: e.target.value })}
                      placeholder="e.g., Toronto, ON"
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="feeAgreement" className="text-slate-700 font-medium">
                      Fee Agreement
                    </Label>
                    <Input
                      id="feeAgreement"
                      value={clientFormData.feeAgreement}
                      onChange={(e) => setClientFormData({ ...clientFormData, feeAgreement: e.target.value })}
                      placeholder="e.g., 20% Contingent"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* General Notes */}
              <div>
                <Label htmlFor="notes" className="text-slate-700 font-medium">
                  General Notes
                </Label>
                <Textarea
                  id="notes"
                  value={clientFormData.notes}
                  onChange={(e) => setClientFormData({ ...clientFormData, notes: e.target.value })}
                  placeholder="Add any additional notes about this client..."
                  className="mt-1 min-h-[100px] resize-y"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsClientDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingClient ? "Update Client" : "Save Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add New Contact Dialog */}
        <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">Add New Contact</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmitContact} className="space-y-6 mt-4">
              {/* Contact Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-slate-700 font-medium">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    value={contactFormData.fullName}
                    onChange={(e) => setContactFormData({ ...contactFormData, fullName: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="clientCompany" className="text-slate-700 font-medium">
                    Client Company <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCompanyDropdownOpen}
                      className="w-full justify-between bg-transparent"
                      onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                    >
                      {contactFormData.clientCompany || "Select a company..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    {isCompanyDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                        <div className="p-2">
                          <Input
                            placeholder="Search companies..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredCompaniesForDropdown.length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-500">No company found.</div>
                          ) : (
                            filteredCompaniesForDropdown.map((company) => (
                              <button
                                key={company.id}
                                type="button"
                                onClick={() => handleSelectCompany(company.companyName)}
                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${contactFormData.clientCompany === company.companyName ? "opacity-100" : "opacity-0"}`}
                                />
                                {company.companyName}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="jobTitle" className="text-slate-700 font-medium">
                    Job Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="jobTitle"
                    value={contactFormData.jobTitle}
                    onChange={(e) => setContactFormData({ ...contactFormData, jobTitle: e.target.value })}
                    placeholder="e.g., HR Manager"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    placeholder="e.g., john.smith@company.com"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-slate-700 font-medium">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    placeholder="e.g., (416) 555-0123"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="linkedIn" className="text-slate-700 font-medium">
                    LinkedIn Profile URL
                  </Label>
                  <Input
                    id="linkedIn"
                    type="url"
                    value={contactFormData.linkedIn}
                    onChange={(e) => setContactFormData({ ...contactFormData, linkedIn: e.target.value })}
                    placeholder="e.g., linkedin.com/in/johnsmith"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="contactNotes" className="text-slate-700 font-medium">
                  Notes
                </Label>
                <Textarea
                  id="contactNotes"
                  value={contactFormData.notes}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  placeholder="Add any additional notes about this contact..."
                  className="mt-1 min-h-[120px] resize-y"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsContactDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Save Contact
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
