"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"

type ClientStatus = "Active Client" | "Prospect" | "Past Client" | "Do Not Contact"
type JobStatus = "Open" | "Interviewing" | "On Hold" | "Placed" | "Canceled"
type JobPriority = "High" | "Medium" | "Low"
type ApplicantStatus = "New" | "Screening" | "Submitted" | "Interview" | "Offer" | "Placed" | "Rejected"

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
  createdBy?: string // Email of the user who created this client
}

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
  createdBy?: string // Email of the user who created this job
}

interface Applicant {
  id: string
  fullName: string
  email: string
  phone: string
  linkedinUrl: string
  currentJobTitle: string
  currentCompany: string
  primarySkill: string
  totalYOE: number
  status: ApplicantStatus
  source: string
  dateApplied: string
  location: string
  availability: string
  desiredSalary: string
  secondarySkills: string[]
  resume: string
  notes: string
  rating?: number
}

interface DataContextType {
  clients: Client[]
  addClient: (client: Omit<Client, "id">) => Promise<void>
  updateClient: (id: string, client: Partial<Client>) => Promise<void>
  deleteClient: (id: string) => Promise<void>
  jobOrders: JobOrder[]
  addJobOrder: (jobOrder: Omit<JobOrder, "id">) => Promise<void>
  updateJobOrder: (id: string, jobOrder: Partial<JobOrder>) => Promise<void>
  deleteJobOrder: (id: string) => Promise<void>
  applicants: Applicant[]
  addApplicant: (applicant: Omit<Applicant, "id">) => Promise<void>
  updateApplicant: (id: string, applicant: Partial<Applicant>) => Promise<void>
  deleteApplicant: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[]
      setClients(clientsData)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "jobOrders"), (snapshot) => {
      const jobOrdersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as JobOrder[]
      setJobOrders(jobOrdersData)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "applicants"), (snapshot) => {
      const applicantsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Applicant[]
      setApplicants(applicantsData)
    })
    return () => unsubscribe()
  }, [])

  const addClient = async (client: Omit<Client, "id">) => {
    await addDoc(collection(db, "clients"), client)
  }

  const updateClient = async (id: string, client: Partial<Client>) => {
    await updateDoc(doc(db, "clients", id), client)
  }

  const deleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id))
  }

  const addJobOrder = async (jobOrder: Omit<JobOrder, "id">) => {
    await addDoc(collection(db, "jobOrders"), jobOrder)
  }

  const updateJobOrder = async (id: string, jobOrder: Partial<JobOrder>) => {
    await updateDoc(doc(db, "jobOrders", id), jobOrder)
  }

  const deleteJobOrder = async (id: string) => {
    await deleteDoc(doc(db, "jobOrders", id))
  }

  const addApplicant = async (applicant: Omit<Applicant, "id">) => {
    await addDoc(collection(db, "applicants"), applicant)
  }

  const updateApplicant = async (id: string, applicant: Partial<Applicant>) => {
    await updateDoc(doc(db, "applicants", id), applicant)
  }

  const deleteApplicant = async (id: string) => {
    await deleteDoc(doc(db, "applicants", id))
  }

  return (
    <DataContext.Provider
      value={{
        clients,
        addClient,
        updateClient,
        deleteClient,
        jobOrders,
        addJobOrder,
        updateJobOrder,
        deleteJobOrder,
        applicants,
        addApplicant,
        updateApplicant,
        deleteApplicant,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
