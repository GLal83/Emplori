"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, LogOut, Upload, Settings, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { storage, db } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { doc, getDoc, setDoc } from "firebase/firestore"

export function UserProfile() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile photo from Firestore on mount
  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!user?.uid) return

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (userData.profilePhoto) {
            setProfilePhoto(userData.profilePhoto)
          }
        }
      } catch (error) {
        console.error("Error loading profile photo:", error)
      }
    }

    loadProfilePhoto()
  }, [user?.uid])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB")
        return
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file")
        return
      }

      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSavePhoto = async () => {
    if (!previewUrl || !selectedFile || !user?.uid) {
      alert("Please select a photo first")
      return
    }

    setIsUploading(true)

    try {
      // Step 1: Upload to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${selectedFile.name}`)
      await uploadBytes(storageRef, selectedFile)
      const downloadURL = await getDownloadURL(storageRef)

      // Step 2: Save URL to Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          profilePhoto: downloadURL,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      // Step 3: Update local state
      setProfilePhoto(downloadURL)
      setPreviewUrl(null)
      setSelectedFile(null)
      setIsProfileDialogOpen(false)

      alert("Profile photo updated successfully!")
    } catch (error) {
      console.error("Error saving profile photo:", error)
      alert(`Error saving profile photo: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsUploading(false)
    }
  }

  const getInitials = () => {
    const email = user?.email || "Admin"
    return email.substring(0, 2).toUpperCase()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-slate-100">
            <Avatar className="h-10 w-10 border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-colors">
              <AvatarImage src={profilePhoto || undefined} alt="Profile" />
              <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{getInitials()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Admin User</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Edit Profile Photo</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32 border-4 border-slate-200">
                <AvatarImage src={previewUrl || profilePhoto || undefined} alt="Profile Preview" />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Upload a profile photo</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Choose Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Recommendations:</Label>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>Square image works best</li>
                <li>At least 400x400 pixels</li>
                <li>Max file size: 5MB</li>
                <li>JPG, PNG, or GIF format</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsProfileDialogOpen(false)
                setPreviewUrl(null)
                setSelectedFile(null)
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePhoto}
              disabled={!previewUrl || isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Photo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
