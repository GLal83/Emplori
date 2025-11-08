# Deployment Guide for Emplori Webapp

This guide covers deploying your Next.js application to production.

## Option 1: Vercel (Recommended - Easiest)

Vercel is the company behind Next.js and offers the best integration and performance.

### Prerequisites
1. A GitHub, GitLab, or Bitbucket account
2. Your code pushed to a repository

### Step-by-Step Deployment

#### 1. Push Your Code to GitHub
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create a repository on GitHub, then:
git remote add origin https://github.com/yourusername/emplori-webapp.git
git branch -M main
git push -u origin main
```

#### 2. Deploy to Vercel

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to https://vercel.com
2. Sign up/Login with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

**Option B: Via Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

#### 3. Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Emplori <noreply@yourdomain.com>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important:** 
- Add these for **Production**, **Preview**, and **Development** environments
- After adding env vars, redeploy your app

#### 4. Update Firebase Authorized Domains

1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain: `your-app.vercel.app`
3. Add your custom domain (if you set one up)

#### 5. (Optional) Set Up Custom Domain

1. In Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` to your custom domain

---

## Option 2: Firebase Hosting

Since you're already using Firebase, you can host on Firebase Hosting.

### Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project initialized

### Step-by-Step Deployment

#### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

#### 2. Login to Firebase
```bash
firebase login
```

#### 3. Initialize Firebase Hosting
```bash
firebase init hosting
```

Select:
- **What do you want to use as your public directory?** → `out` (for static export) or `.next` (for server-side)
- **Configure as a single-page app?** → `No`
- **Set up automatic builds and deploys with GitHub?** → `Yes` (optional)

#### 4. Update next.config.ts for Static Export (if needed)

If you want static export:
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  }
};
```

**Note:** Static export won't work with Server Actions. For full functionality, use Vercel or Firebase Hosting with Next.js runtime.

#### 5. Build and Deploy
```bash
# Build the app
npm run build

# Deploy
firebase deploy --only hosting
```

#### 6. Configure Environment Variables

For Firebase Hosting with Next.js, you'll need to use Firebase Functions or configure env vars in Firebase Console.

---

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] Remove any console.log statements (or use proper logging)
- [ ] Test all features locally
- [ ] Ensure `.env.local` is in `.gitignore`
- [ ] Update any hardcoded URLs to use environment variables

### ✅ Environment Variables
- [ ] All Firebase config variables
- [ ] Google Gemini API key
- [ ] Resend API key
- [ ] App URL (for email links)

### ✅ Firebase Configuration
- [ ] Firebase Storage rules deployed (`storage.rules`)
- [ ] Firestore security rules configured
- [ ] Authorized domains updated in Firebase Auth
- [ ] CORS settings configured (if needed)

### ✅ Testing
- [ ] Test authentication flow
- [ ] Test file uploads (resumes, profile photos)
- [ ] Test email invitations
- [ ] Test AI features (resume parsing, analysis)
- [ ] Test on mobile devices

### ✅ Security
- [ ] Review Firebase security rules
- [ ] Ensure API keys are in environment variables (not in code)
- [ ] Enable HTTPS only
- [ ] Review user permissions and roles

---

## Post-Deployment

### 1. Test Your Live Site
- Visit your deployed URL
- Test login/logout
- Test all major features
- Check mobile responsiveness

### 2. Monitor Performance
- Use Vercel Analytics (if using Vercel)
- Monitor Firebase usage
- Check error logs

### 3. Set Up Continuous Deployment
- Connect GitHub repository
- Enable automatic deployments on push
- Set up preview deployments for pull requests

### 4. Configure Custom Domain (Optional)
- Purchase domain
- Configure DNS
- Add domain to hosting platform
- Update Firebase authorized domains

---

## Troubleshooting

### Build Errors
- Check Node.js version (should be 18+)
- Clear `.next` folder and rebuild
- Check for TypeScript errors: `npm run lint`

### Environment Variables Not Working
- Ensure variables are prefixed correctly (`NEXT_PUBLIC_` for client-side)
- Redeploy after adding env vars
- Check variable names match exactly

### Firebase Errors
- Verify Firebase config matches your project
- Check authorized domains
- Review Firebase console for errors

### Email Not Sending
- Verify Resend API key is set
- Check Resend dashboard for email logs
- Verify domain is verified (if using custom domain)

---

## Recommended: Vercel

**Why Vercel?**
- ✅ Zero-config Next.js deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Serverless functions included
- ✅ Preview deployments
- ✅ Free tier is generous
- ✅ Best performance for Next.js

**Free Tier Includes:**
- 100GB bandwidth/month
- Unlimited deployments
- Preview deployments
- Automatic SSL certificates

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Firebase Hosting Docs: https://firebase.google.com/docs/hosting
- Next.js Deployment: https://nextjs.org/docs/deployment

