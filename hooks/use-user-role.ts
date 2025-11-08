"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

type UserRole = "Admin" | "Recruiter" | "Viewer" | null

export function useUserRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email) {
        setRole(null)
        setLoading(false)
        return
      }

      try {
        // Query teamMembers collection by email
        const { collection, query, where, getDocs } = await import("firebase/firestore")
        const q = query(collection(db, "teamMembers"), where("email", "==", user.email?.toLowerCase()))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const memberData = querySnapshot.docs[0].data()
          setRole(memberData.role as UserRole)
        } else {
          // Default to Admin if not found (for backward compatibility)
          setRole("Admin")
        }
      } catch (error) {
        console.error("Error fetching user role:", error)
        // Default to Admin for backward compatibility
        setRole("Admin")
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [user?.email])

  const isAdmin = role === "Admin"
  const isRecruiter = role === "Recruiter"
  const isViewer = role === "Viewer"
  const canEdit = isAdmin || isRecruiter
  const canDelete = isAdmin || isRecruiter

  return {
    role,
    loading,
    isAdmin,
    isRecruiter,
    isViewer,
    canEdit,
    canDelete,
    userEmail: user?.email || null,
  }
}

