# Data Processing Agreement (DPA) Template

**Version:** 1.0  
**Effective Date:** [DATE]  
**Parties:** HomeworkHelper ("Processor") and [DISTRICT NAME] ("Controller")

---

## 1. Parties & Definitions

**Processor:** HomeworkHelper AI, LLC  
**Controller:** [DISTRICT NAME], a school district organized under the laws of [STATE]  
**Services:** AI-powered homework grading platform at letsmakeai.fun  
**Personal Data:** Any information relating to an identified or identifiable natural person ("Data Subject")  
**Student Data:** Education records as defined by FERPA (34 CFR §99.3)  
**Processing:** Any operation performed on Personal Data

---

## 2. Scope & Duration

This DPA applies to all Processing of Personal Data by Processor on behalf of Controller in connection with the Services.  
**Term:** Commences on Effective Date; continues for duration of Service Agreement.  
**Termination:** Either party may terminate per Service Agreement; upon termination, Processor will delete or return all Personal Data within 30 days.

---

## 3. Data Categories & Processing Purposes

| Category | Data Subjects | Purpose | Legal Basis |
|----------|---------------|---------|-------------|
| Teacher Account Data | Teachers/Staff | Authentication, billing, account management | Contract (Art. 6(1)(b) GDPR) |
| Student Names | Students | Grading, Classroom sync, feedback | Legitimate Interest / FERPA School Official |
| Student Emails | Students | Classroom sync, grade return | Legitimate Interest / FERPA School Official |
| Google Classroom IDs | Students/Teachers | Sync courses, assignments, submissions | Contract / Legitimate Interest |
| Grading Results | Students | Feedback, progress tracking, Classroom return | Contract / Educational Interest |
| Audit Logs | Teachers/Students | Security, compliance, FERPA record-keeping | Legal Obligation / Legitimate Interest |

**Special Categories:** No sensitive personal data (health, biometrics, etc.) is processed.

---

## 4. Processor Obligations

### 4.1 Processing Only on Instructions
Processor shall Process Personal Data only on documented instructions from Controller, including this DPA and the Service Agreement.

### 4.2 Confidentiality
Processor ensures all personnel authorized to Process Personal Data are subject to confidentiality obligations.

### 4.3 Security Measures
Processor implements appropriate technical and organizational measures:
- Encryption in transit (TLS 1.2+) and at rest (Neon PostgreSQL, AES-256)
- Password hashing (bcrypt, cost factor 12)
- Refresh tokens stored as SHA-256 hashes
- HttpOnly, Secure, SameSite=Lax cookies
- Helmet.js security headers
- Role-based access control
- Regular vulnerability scanning & dependency updates
- Annual penetration testing

### 4.4 Sub-processors
Processor engages the following Sub-processors:

| Sub-processor | Purpose | Location | Safeguards |
|---------------|---------|----------|------------|
| Google Cloud (Gemini API) | AI grading, OCR | USA | SCCs, ISO 27001 |
| Stripe | Payment processing | USA | PCI DSS, SCCs |
| Neon (PostgreSQL) | Database hosting | USA | SOC 2, encryption |
| Railway | Application hosting | USA | SOC 2, encryption |

**Changes:** Processor will notify Controller 30 days before adding new Sub-processors. Controller may object within 14 days.

### 4.5 Data Subject Rights
Processor assists Controller in fulfilling Data Subject requests:
- Access, rectification, erasure, restriction, portability
- Response within 30 days of Controller request
- No direct requests from Data Subjects to Processor

### 4.6 Breach Notification
Processor shall notify Controller within **24 hours** of becoming aware of a Personal Data breach, including:
- Nature of breach
- Categories & approximate number of Data Subjects affected
- Likely consequences
- Measures taken/remedial actions

### 4.7 Deletion & Return
Upon termination, Processor shall (at Controller's choice):
- Delete all Personal Data
- Return all Personal Data in machine-readable format
- Provide written certification of deletion

---

## 5. International Data Transfers

**Hosting:** All infrastructure hosted in United States (Railway, Neon, Google Cloud, Stripe).  
**Mechanism:** Standard Contractual Clauses (SCCs) per EU Commission Decision 2021/914 (or UK equivalent).  
**Supplemental Measures:** Encryption in transit/rest, access controls, no government access requests received to date.

---

## 6. Audit Rights

Controller may audit Processor's compliance:
- **Notice:** 30 days written notice
- **Scope:** Relevant facilities, systems, records
- **Frequency:** Once per 12 months (or upon breach)
- **Cost:** Controller bears cost unless material non-compliance found
- **Confidentiality:** Audit results treated as confidential

---

## 7. FERPA-Specific Provisions

Processor acts as **School Official** under FERPA (34 CFR §99.31):
- **Legitimate Educational Interest:** Processing limited to grading, feedback, Classroom sync
- **No Redisclosure:** Processor will not redisclose Student Data without Controller consent
- **Record-Keeping:** Processor maintains audit logs of all Student Data access for 5 years
- **Parent/Student Rights:** Processor assists Controller with FERPA access/amendment requests
- **Annual Notification:** Processor supports Controller's annual FERPA notification

---

## 8. Liability & Indemnification

- **Processor Liability:** Limited to direct damages up to 12 months' fees paid
- **Indemnification:** Each party indemnifies the other for breaches of this DPA
- **Exclusions:** No liability for indirect, consequential, or punitive damages

---

## 9. General Provisions

- **Governing Law:** Laws of [STATE], USA (or [COUNTRY] if non-US)
- **Dispute Resolution:** Good faith negotiation → mediation → binding arbitration
- **Entire Agreement:** This DPA, Service Agreement, and Privacy Policy constitute entire agreement
- **Amendments:** Written agreement by both parties
- **Severability:** Invalid provisions severed; remainder enforced
- **No Third-Party Beneficiaries:** Except Data Subjects for rights enforcement

---

## 10. Signatures

**Processor: HomeworkHelper AI, LLC**

_________________________________________  
Name: [NAME]  
Title: [TITLE]  
Date: [DATE]

**Controller: [DISTRICT NAME]**

_________________________________________  
Name: [NAME]  
Title: [TITLE]  
Date: [DATE]

---

## Appendix A: Standard Contractual Clauses (Summary)

*Full SCCs attached as separate document per EU Commission Decision 2021/914.*

---

## Appendix B: Technical & Organizational Measures (TOM)

| Measure | Implementation |
|---------|----------------|
| Access Control | Role-based (teacher, admin), MFA optional |
| Encryption at Rest | Neon PostgreSQL (AES-256), S3 (AES-256) |
| Encryption in Transit | TLS 1.2+ for all connections |
| Pseudonymization | Student names stored separately from grading data |
| Availability | Railway auto-scaling, Neon read replicas |
| Integrity | Database constraints, API validation, checksums |
| Resilience | Automated backups (Neon), multi-AZ deployment |
| Incident Response | 24/7 monitoring, 24-hr breach notification |
| Data Minimization | No student accounts; only teacher-initiated data |
| Retention | Configurable per retention_policies table |