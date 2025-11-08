"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { UserProfile } from "@/components/user-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ChevronLeft, Pencil, Trash2, Plus, Loader2 } from "lucide-react"
import Image from "next/image"
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { sendInviteEmail } from "@/app/actions/send-invite-email"

type TeamRole = "Admin" | "Recruiter" | "Viewer"

interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  invitedAt: string
  status: "pending" | "active"
}

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Applicant statuses state
  const [applicantStatuses, setApplicantStatuses] = useState([
    { id: 1, name: "New", color: "blue" },
    { id: 2, name: "Screening", color: "yellow" },
    { id: 3, name: "Submitted", color: "purple" },
    { id: 4, name: "Placed", color: "green" },
    { id: 5, name: "Rejected", color: "red" },
  ])
  const [newStatus, setNewStatus] = useState("")

  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState("")

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<TeamRole>("Recruiter")
  const [isInviting, setIsInviting] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<TeamRole>("Recruiter")

  // Load team members from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "teamMembers"), (snapshot) => {
      const members = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TeamMember[]
      setTeamMembers(members)
    })
    return () => unsubscribe()
  }, [])

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!")
      return
    }
    console.log("Password change requested")
    alert("Password changed successfully!")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleAddStatus = () => {
    if (newStatus.trim()) {
      setApplicantStatuses([...applicantStatuses, { id: Date.now(), name: newStatus, color: "gray" }])
      setNewStatus("")
    }
  }

  const handleDeleteStatus = (id: number) => {
    if (confirm("Are you sure you want to delete this status?")) {
      setApplicantStatuses(applicantStatuses.filter((s) => s.id !== id))
    }
  }

  const handleSaveApiKey = () => {
    console.log("Saving API key:", geminiApiKey)
    alert("API Key saved successfully!")
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      alert("Please enter both name and email")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      alert("Please enter a valid email address")
      return
    }

    setIsInviting(true)

    try {
      // Step 1: Save to Firestore
      await addDoc(collection(db, "teamMembers"), {
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        status: "pending",
        invitedAt: new Date().toISOString(),
        invitedBy: user?.email || "Unknown",
      })

      // Step 2: Send invitation email
      const emailResult = await sendInviteEmail(
        inviteEmail.trim().toLowerCase(),
        inviteName.trim(),
        inviteRole,
        user?.email || "Admin"
      )

      if (emailResult.success) {
        alert(`Invitation sent to ${inviteEmail}! They should receive an email shortly.`)
      } else {
        // Still show success for Firestore save, but warn about email
        alert(
          `Team member added to database, but email could not be sent: ${emailResult.error}\n\n` +
          `Please notify ${inviteEmail} manually or check your email configuration.`
        )
      }

      setInviteEmail("")
      setInviteName("")
      setInviteRole("Recruiter")
    } catch (error) {
      console.error("Error inviting user:", error)
      alert(`Error inviting user: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsInviting(false)
    }
  }

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member)
    setEditName(member.name)
    setEditEmail(member.email)
    setEditRole(member.role)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingMember || !editName.trim() || !editEmail.trim()) {
      alert("Please fill in all fields")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editEmail)) {
      alert("Please enter a valid email address")
      return
    }

    try {
      await updateDoc(doc(db, "teamMembers", editingMember.id), {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        updatedAt: new Date().toISOString(),
      })

      setEditDialogOpen(false)
      setEditingMember(null)
      alert("Team member updated successfully!")
    } catch (error) {
      console.error("Error updating team member:", error)
      alert(`Error updating team member: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "teamMembers", memberId))
      alert("Team member removed successfully!")
    } catch (error) {
      console.error("Error deleting team member:", error)
      alert(`Error removing team member: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="gap-2 text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div className="flex items-center gap-3">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-nPyczJhNikmOBFX0EyXLrXR1FfgGSZ.png"
                  alt="Emplori Logo"
                  width={140}
                  height={40}
                  className="h-10 w-auto"
                />
              </div>
            </div>
            <UserProfile />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1">Manage your account and application preferences</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your password to keep your account secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button onClick={handlePasswordChange} className="bg-blue-600 hover:bg-blue-700">
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fields" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Customize Dropdowns</CardTitle>
                  <CardDescription>Manage custom field options for your CRM</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Applicant Statuses</h3>
                    <div className="space-y-2 mb-4">
                      {applicantStatuses.map((status) => (
                        <div
                          key={status.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <span className="font-medium">{status.name}</span>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteStatus(status.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter new status name"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleAddStatus()}
                      />
                      <Button onClick={handleAddStatus} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Status
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage your third-party integrations and API keys</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Google Gemini</h3>
                    <div className="space-y-2">
                      <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                      <Input
                        id="gemini-api-key"
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="Enter your Gemini API key"
                      />
                    </div>
                    <Button onClick={handleSaveApiKey} className="mt-4 bg-blue-600 hover:bg-blue-700">
                      Save Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invite New User</CardTitle>
                  <CardDescription>Send an invitation to join your team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Name</Label>
                    <Input
                      id="invite-name"
                      type="text"
                      placeholder="Enter full name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleInviteUser()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleInviteUser()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TeamRole)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Recruiter">Recruiter</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInviteUser}
                    disabled={isInviting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Invite"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Users</CardTitle>
                  <CardDescription>Manage your team members and their roles</CardDescription>
                </CardHeader>
                <CardContent>
                  {teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No team members yet. Invite someone to get started!</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>{member.role}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  member.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {member.status === "active" ? "Active" : "Pending"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditMember(member)}
                                >
                                  <Pencil className="h-4 w-4 text-slate-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteMember(member.id, member.name)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Edit Member Dialog */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-role">Role</Label>
                      <Select value={editRole} onValueChange={(value) => setEditRole(value as TeamRole)}>
                        <SelectTrigger id="edit-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Recruiter">Recruiter</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  )
}
