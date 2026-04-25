<h1 align="center">
  🧾 TaxMate — AI-Powered Tax Compliance for Malaysian SMEs
</h1>

<p align="center">
  <strong>Team 166_EyeScream</strong> · Domain 1: AI Systems & Agentic Workflow Automation · UMHackathon 2026
</p>

<p align="center">
  <em>TaxMate transforms the fragmented, manual tax compliance process between SME owners and accountants into an intelligent, end-to-end automated workflow — powered by Z.AI GLM as the central reasoning engine.</em>
</p>

---

<h2>📑 Table of Contents</h2>

<ol>
  <li><a href="#1-pitching-video">Pitching Video</a></li>
  <li><a href="#2-problem-statement">Problem Statement</a></li>
  <li><a href="#3-our-solution">Our Solution</a></li>
  <li><a href="#4-key-features">Key Features</a></li>
  <li><a href="#5-system-architecture">System Architecture</a></li>
  <li><a href="#6-ai-agent-architecture">AI Agent Architecture</a></li>
  <li><a href="#7-tech-stack">Tech Stack</a></li>
  <li><a href="#8-database-schema">Database Schema</a></li>
  <li><a href="#9-getting-started">Getting Started</a></li>
  <li><a href="#10-project-structure">Project Structure</a></li>
  <li><a href="#11-api-endpoints">API Endpoints</a></li>
  <li><a href="#12-team-members">Team Members</a></li>
</ol>

---

<h2 id="1-pitching-video">1. 🎬 Pitching Video</h2>

https://cloudmails-my.sharepoint.com/:v:/g/personal/tp080968_mail_apu_edu_my/IQAAFlFgZT6qRpuPkozYifhlAZhTgnWD3bShowUne9VPLuo?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&e=08QsXk

---

<h2 id="2-problem-statement">2. 🔥 Problem Statement</h2>

<p>
  Malaysia's <strong>140,000+ SMEs</strong> in the RM1M–10M revenue bracket face a persistent tax compliance crisis that existing tools have failed to solve.
</p>

<table>
  <tr>
    <th>Pain Point</th>
    <th>Impact</th>
  </tr>
  <tr>
    <td>Receipts pile up in shoeboxes, coordination happens over WhatsApp/Email</td>
    <td><strong>8–15 hours</strong> of manual work per bi-monthly SST filing cycle</td>
  </tr>
  <tr>
    <td>Accountants spend 60–70% of time on low-value data entry</td>
    <td>Each accountant can only serve <strong>8–12 clients/month</strong></td>
  </tr>
  <tr>
    <td>E-Invoice Phase 4 (Jan 2026) introduces new compliance layers</td>
    <td>Penalties of <strong>RM200–20,000</strong> per non-compliant invoice</td>
  </tr>
  <tr>
    <td>No existing solution bridges the owner ↔ accountant gap</td>
    <td>Generic software needs manual input; full-service firms are cost-prohibitive</td>
  </tr>
</table>

---

<h2 id="3-our-solution">3. 💡 Our Solution</h2>

<p>
  <strong>TaxMate</strong> is a GLM-powered intelligent tax compliance platform that connects SME owners and accountants through a single, AI-driven pipeline.
</p>

<table>
  <tr>
    <th>For Owners</th>
    <th>AI Engine</th>
    <th>For Accountants</th>
  </tr>
  <tr>
    <td>Upload receipts (batch drag-and-drop)</td>
    <td rowspan="3" align="center"><strong>Z.AI GLM</strong><br>(ilmu-glm-5.1)<br><br>Multi-agent reasoning<br>Tool-use function calling<br>Stateful orchestration</td>
    <td>AI-prioritised review queue</td>
  </tr>
  <tr>
    <td>AI auto-extracts, classifies, detects anomalies</td>
    <td>3-panel workspace with transparent AI reasoning</td>
  </tr>
  <tr>
    <td>Download Draft SST-02, get Tax Insights</td>
    <td>Digital sign-off → auto-generates signed SST-02 PDF</td>
  </tr>
</table>

<blockquote>
  <strong>Key Insight:</strong> If the GLM component is removed, TaxMate becomes a mere file storage tool. The AI is what makes the workflow intelligent, adaptive, and scalable.
</blockquote>

---

<h2 id="4-key-features">4. ✨ Key Features</h2>

<h3>P0 — Core Compliance Workflow</h3>

<table>
  <tr>
    <th>Feature</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><strong>Smart Registration & Accountant Matching</strong></td>
    <td>Owners select business sector → system auto-matches with an accountant by expertise. Or specify a preferred accountant by email for exclusive binding.</td>
  </tr>
  <tr>
    <td><strong>AI Receipt Upload & Classification</strong></td>
    <td>Batch drag-and-drop (PDF, JPG, PNG). PaddleOCR extracts text → GLM Tax Agent executes multi-step tool-calling pipeline (SST rule lookup, SST number validation, tax cross-verification, anomaly flagging, tax advice) → structured JSON output with confidence scores and risk flags.</td>
  </tr>
  <tr>
    <td><strong>Agent Thinking Panel</strong></td>
    <td>Real-time streaming display of each AI agent's reasoning steps, tool calls, and logic outputs — fully transparent and auditable.</td>
  </tr>
  <tr>
    <td><strong>Document Repository</strong></td>
    <td>Period-specific document management. View all receipts, AI processing status, confidence scores. Pre-submission checklist before locking.</td>
  </tr>
  <tr>
    <td><strong>Document Lock on Submission</strong></td>
    <td>Ensures the accountant reviews exactly what was submitted — no post-submission edits.</td>
  </tr>
  <tr>
    <td><strong>Auto-Approval at ≥90% Confidence</strong></td>
    <td>High-confidence receipts with 0 risk flags are auto-approved. Accountants only review flagged items.</td>
  </tr>
  <tr>
    <td><strong>Anomaly Detection (Dual-Layer)</strong></td>
    <td>Layer 1: Rule-based validation (TIN/SST format, amount consistency). Layer 2: GLM reasoning (missing info, contextual inconsistencies) with plain-language explanations.</td>
  </tr>
  <tr>
    <td><strong>AI Summary Briefing</strong></td>
    <td>GLM generates a batch overview for accountants: total documents, risk distribution, flagged anomalies, recommended focus areas.</td>
  </tr>
  <tr>
    <td><strong>3-Panel Accountant Workspace</strong></td>
    <td>Left: original document image. Centre: editable AI-extracted fields. Right: Agent Thinking Panel with full reasoning chain.</td>
  </tr>
  <tr>
    <td><strong>Digital Signature Pad</strong></td>
    <td>Canvas-based handwritten signature. Authenticates the finalized SST form.</td>
  </tr>
  <tr>
    <td><strong>SST-02 PDF Generation</strong></td>
    <td>AI maps documents to SST-02 B1 rows → auto-fills official JKDM AcroForm template → overlays digital signature → generates both Draft and Signed versions.</td>
  </tr>
  <tr>
    <td><strong>Automated Email Notifications</strong></td>
    <td>AI-personalised emails at key workflow stages. Signed PDF delivered to owner upon accountant sign-off.</td>
  </tr>
</table>

<h3>P1 — Enhanced Intelligence (Differentiators)</h3>

<table>
  <tr>
    <th>Feature</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><strong>"What Next?" Recommendations</strong></td>
    <td>Workflow Orchestrator assesses risk levels, document states, and filing deadlines → provides adaptive, personalised next-step recommendations.</td>
  </tr>
  <tr>
    <td><strong>Tax Insights Dashboard</strong></td>
    <td>GLM analyses spending patterns to surface deductible thresholds, recurring anomalies, tax-saving suggestions — presented as plain-language recommendations.</td>
  </tr>
  <tr>
    <td><strong>Cross-Document Batch Analysis</strong></td>
    <td>Analyses all documents in a filing period for duplicates, anomalies, compliance risks, and tax optimisation opportunities.</td>
  </tr>
  <tr>
    <td><strong>Owner AI Chatbot</strong></td>
    <td>Embedded in Owner Dashboard. Real-time tax Q&A, SST classification guidance, filing deadline reminders.</td>
  </tr>
  <tr>
    <td><strong>Accountant AI Chat Assistant</strong></td>
    <td>Embedded in Accountant Workbench. Query tax rules and resolve ambiguous classifications without leaving the workspace.</td>
  </tr>
  <tr>
    <td><strong>Download Station</strong></td>
    <td>Access both Draft SST-02 (pre-accountant review) and final Signed SST-02 (post-sign-off).</td>
  </tr>
  <tr>
    <td><strong>Accountant Efficiency Summary</strong></td>
    <td>Performance analytics dashboard: documents reviewed, time saved, client pipeline status, workload visibility across all clients.</td>
  </tr>
  <tr>
    <td><strong>Owner & Accountant Profile Management</strong></td>
    <td>Company profile (TIN, SST ID, sector), accountant credentials, expertise areas configuration.</td>
  </tr>
</table>

---

<h2 id="5-system-architecture">5. 🏗️ System Architecture</h2>

<h3>High-Level Overview</h3>

<table>
  <tr>
    <th>Aspect</th>
    <th>Details</th>
  </tr>
  <tr>
    <td>System Type</td>
    <td>Web Application</td>
  </tr>
  <tr>
    <td>Architecture</td>
    <td>Modular Monolith with decoupled Frontend-Backend</td>
  </tr>
  <tr>
    <td>Deployment</td>
    <td>Docker Compose</td>
  </tr>
  <tr>
    <td>LLM Integration</td>
    <td>Z.AI GLM (ilmu-glm-5.1) via Anthropic-compatible SDK</td>
  </tr>
</table>

<h3>Component Interactions</h3>

<ol>
  <li><strong>React Frontend → FastAPI Backend:</strong> Axios HTTP with JWT Bearer token (REST JSON/Multipart)</li>
  <li><strong>FastAPI → Z.AI GLM API:</strong> Anthropic-compatible function calling via <code>client.messages.create()</code>. Base URL: <code>api.ilmu.ai/anthropic</code>. Model: <code>ilmu-glm-5.1</code>. Timeout: 180s. Max retries: 2.</li>
  <li><strong>FastAPI → PostgreSQL:</strong> SQLAlchemy ORM queries for CRUD on users and documents tables</li>
  <li><strong>PaddleOCR:</strong> Local in-process ML library, no network dependency. Supports English, Bahasa Malaysia, and Simplified Chinese.</li>
  <li><strong>FastAPI → SMTP:</strong> fastapi-mail sends signed SST-02 PDFs with AI-personalised content via STARTTLS</li>
  <li><strong>Vite Dev Server → FastAPI:</strong> Proxy configuration for <code>/api</code> routes (5173 → 8000)</li>
</ol>

<h3>Token Enforcement</h3>

<table>
  <tr>
    <th>Component</th>
    <th>Limit</th>
  </tr>
  <tr>
    <td>Tax Agent</td>
    <td>Max 8 steps/document. <code>max_tokens=4096</code></td>
  </tr>
  <tr>
    <td>Batch Analysis</td>
    <td>Max 200 documents per prompt</td>
  </tr>
  <tr>
    <td>Workflow Orchestrator</td>
    <td>Max 5 steps per invocation</td>
  </tr>
  <tr>
    <td>Text Generation</td>
    <td><code>max_tokens=2048</code></td>
  </tr>
  <tr>
    <td>Rate Limit Retry</td>
    <td>Tenacity exponential backoff (3 attempts, 2–10s wait)</td>
  </tr>
</table>

---

<h2 id="6-ai-agent-architecture">6. 🤖 AI Agent Architecture — 3-Layer Agentic System</h2>

<p>TaxMate is <strong>not a chatbot</strong>. It is a multi-agent, stateful compliance engine powered by Z.AI GLM.</p>

<h3>Agent 1: Single-Document Tax Agent</h3>

<table>
  <tr>
    <th>Aspect</th>
    <th>Details</th>
  </tr>
  <tr>
    <td>File</td>
    <td><code>tax_agent.py</code></td>
  </tr>
  <tr>
    <td>Pattern</td>
    <td>Tool-use loop with function calling</td>
  </tr>
  <tr>
    <td>Behaviour</td>
    <td>LLM autonomously calls 3–6 tools per document, up to 8 reasoning steps</td>
  </tr>
  <tr>
    <td>Tools</td>
    <td><code>lookup_sst_rule</code>, <code>validate_sst_number</code>, <code>calculate_tax</code>, <code>flag_for_human_review</code>, <code>generate_tax_advice</code></td>
  </tr>
  <tr>
    <td>Output</td>
    <td>Structured JSON: <code>doc_type</code>, <code>supplier</code>, <code>amount</code>, <code>tax_treatment</code>, <code>confidence</code>, <code>risk_flags</code>, <code>reasoning</code></td>
  </tr>
  <tr>
    <td>Reliability</td>
    <td>Strict JSON parsing with <code>_clean_json()</code> and <code>_repair_json()</code> fallbacks. Temperature=0.1</td>
  </tr>
</table>

<h3>Agent 2: Cross-Document Batch Analyzer</h3>

<table>
  <tr>
    <th>Aspect</th>
    <th>Details</th>
  </tr>
  <tr>
    <td>File</td>
    <td><code>tax_agent.py → analyze_monthly_batch()</code></td>
  </tr>
  <tr>
    <td>Pattern</td>
    <td>Single-prompt structured output</td>
  </tr>
  <tr>
    <td>Behaviour</td>
    <td>All document summaries in one prompt → specific JSON schema response</td>
  </tr>
  <tr>
    <td>Output</td>
    <td><code>batch_health</code>, <code>totals</code>, <code>duplicate_warnings</code>, <code>anomalies</code>, <code>tax_tips</code>, <code>compliance_issues</code>, <code>filing_readiness</code></td>
  </tr>
</table>

<h3>Agent 3: Workflow Orchestrator</h3>

<table>
  <tr>
    <th>Aspect</th>
    <th>Details</th>
  </tr>
  <tr>
    <td>File</td>
    <td><code>workflow_orchestrator.py</code></td>
  </tr>
  <tr>
    <td>Pattern</td>
    <td>Tool-use loop with rule-based fallback</td>
  </tr>
  <tr>
    <td>7-Stage Pipeline</td>
    <td><code>INTAKE → ANALYSIS → REVIEW_PREP → AWAITING_REVIEW → FILING → NOTIFICATION → COMPLETE</code></td>
  </tr>
  <tr>
    <td>Tools</td>
    <td><code>check_workflow_status</code>, <code>trigger_batch_analysis</code>, <code>prepare_accountant_brief</code>, <code>generate_filing</code>, <code>send_notification</code>, <code>assess_risk_level</code>, <code>recommend_next_action</code></td>
  </tr>
  <tr>
    <td>Adaptive Rules</td>
    <td>&gt;30% risk flags → block filing · deadline proximity &gt;0.9 → fast-track · total &gt;RM10K → extra verification</td>
  </tr>
  <tr>
    <td>Fallback</td>
    <td>Deterministic rule-based recommendation engine if GLM API fails</td>
  </tr>
</table>

<h3>Additional GLM-Powered Features</h3>

<table>
  <tr>
    <th>Function</th>
    <th>Purpose</th>
  </tr>
  <tr>
    <td><code>generate_sst02_field_mapping()</code></td>
    <td>AI decides how documents map to SST-02 B1 rows and tax rate fields</td>
  </tr>
  <tr>
    <td><code>generate_review_brief()</code></td>
    <td>AI summarises document batch for accountant review briefing</td>
  </tr>
  <tr>
    <td><code>generate_personalized_email()</code></td>
    <td>AI writes owner notification emails based on monthly data</td>
  </tr>
  <tr>
    <td><code>answer_accountant_question()</code></td>
    <td>Context-enriched chat over current month's documents</td>
  </tr>
</table>

<h3>Why GLM is Indispensable</h3>

<table>
  <tr>
    <th>Capability</th>
    <th>With GLM</th>
    <th>Without GLM</th>
  </tr>
  <tr>
    <td>Receipt Processing</td>
    <td>Multi-step reasoning: OCR → classify → validate → advise</td>
    <td>Raw text dump</td>
  </tr>
  <tr>
    <td>Anomaly Detection</td>
    <td>Contextual reasoning + plain-language resolution suggestions</td>
    <td>Basic regex checks only</td>
  </tr>
  <tr>
    <td>"What Next?"</td>
    <td>Adaptive recommendations based on risk + deadline + state</td>
    <td>Static checklist</td>
  </tr>
  <tr>
    <td>Batch Analysis</td>
    <td>Cross-document duplicate detection, anomaly spotting, tax optimisation</td>
    <td>Manual spreadsheet comparison</td>
  </tr>
  <tr>
    <td>SST-02 Generation</td>
    <td>AI-driven B1 row mapping and tax classification</td>
    <td>Manual form filling</td>
  </tr>
  <tr>
    <td>Tax Insights</td>
    <td>Pattern analysis with proactive tax-saving suggestions</td>
    <td>No intelligence</td>
  </tr>
</table>

---

<h2 id="7-tech-stack">7. 🛠️ Tech Stack</h2>

<h3>Frontend</h3>

<table>
  <tr>
    <th>Technology</th>
    <th>Purpose</th>
  </tr>
  <tr><td>React 19 + TypeScript</td><td>Type-safe component architecture</td></tr>
  <tr><td>Vite 8</td><td>Fast development server with HMR</td></tr>
  <tr><td>TailwindCSS 4</td><td>Utility-first responsive styling</td></tr>
  <tr><td>React Router 7</td><td>Role-based navigation</td></tr>
  <tr><td>TanStack React Query</td><td>Data fetching and caching</td></tr>
  <tr><td>Axios</td><td>HTTP client with JWT interceptor</td></tr>
  <tr><td>Lucide React</td><td>Icon library</td></tr>
  <tr><td>Canvas API</td><td>Digital signature capture</td></tr>
</table>

<h3>Backend</h3>

<table>
  <tr>
    <th>Technology</th>
    <th>Purpose</th>
  </tr>
  <tr><td>FastAPI (Python 3.10)</td><td>High-performance async web framework with automatic OpenAPI docs</td></tr>
  <tr><td>SQLAlchemy 2.0</td><td>ORM for PostgreSQL</td></tr>
  <tr><td>Uvicorn</td><td>ASGI server</td></tr>
  <tr><td>Z.AI API Client (Anthropic-compatible SDK)</td><td>Function calling for Tax Agent and Orchestrator</td></tr>
  <tr><td>PaddleOCR</td><td>On-premise OCR for Chinese/English/Malay text</td></tr>
  <tr><td>pdfplumber</td><td>PDF text extraction</td></tr>
  <tr><td>pypdf + ReportLab</td><td>SST-02 PDF AcroForm filling and signature overlay</td></tr>
  <tr><td>fastapi-mail</td><td>Async email with SMTP/STARTTLS</td></tr>
  <tr><td>python-jose + bcrypt</td><td>JWT authentication and password hashing</td></tr>
  <tr><td>Tenacity</td><td>Retry with exponential backoff for LLM API calls</td></tr>
</table>

<h3>Database & Deployment</h3>

<table>
  <tr>
    <th>Technology</th>
    <th>Purpose</th>
  </tr>
  <tr><td>PostgreSQL 16</td><td>Relational database (Docker container with persistent volume)</td></tr>
  <tr><td>Docker Compose</td><td>Orchestrates PostgreSQL container; extensible for full containerisation</td></tr>
</table>

---

<h2 id="8-database-schema">8. 🗄️ Database Schema</h2>

<h3>Users Table</h3>

<table>
  <tr><th>Column</th><th>Type</th><th>Notes</th></tr>
  <tr><td><code>id</code></td><td>UUID</td><td>PK</td></tr>
  <tr><td><code>email</code></td><td>String</td><td>Unique</td></tr>
  <tr><td><code>password_hash</code></td><td>String</td><td></td></tr>
  <tr><td><code>role</code></td><td>String</td><td><code>client</code> / <code>accountant</code></td></tr>
  <tr><td><code>company_name</code></td><td>String</td><td></td></tr>
  <tr><td><code>tin_number</code></td><td>String</td><td></td></tr>
  <tr><td><code>business_sector</code></td><td>String</td><td></td></tr>
  <tr><td><code>bound_accountant_id</code></td><td>UUID (FK)</td><td>Self-reference</td></tr>
  <tr><td><code>name</code></td><td>String</td><td></td></tr>
  <tr><td><code>lc_number</code></td><td>String</td><td></td></tr>
  <tr><td><code>expertise_areas</code></td><td>JSON</td><td></td></tr>
</table>

<h3>Documents Table</h3>

<table>
  <tr><th>Column</th><th>Type</th><th>Notes</th></tr>
  <tr><td><code>id</code></td><td>UUID</td><td>PK</td></tr>
  <tr><td><code>client_id</code></td><td>UUID (FK)</td><td>References Users</td></tr>
  <tr><td><code>filename</code></td><td>String</td><td></td></tr>
  <tr><td><code>file_url</code></td><td>String</td><td></td></tr>
  <tr><td><code>ocr_text</code></td><td>Text</td><td></td></tr>
  <tr><td><code>agent_result</code></td><td>JSON</td><td>Full AI classification output</td></tr>
  <tr><td><code>status</code></td><td>String</td><td></td></tr>
  <tr><td><code>doc_type</code></td><td>String</td><td></td></tr>
  <tr><td><code>supplier_name</code></td><td>String</td><td></td></tr>
  <tr><td><code>total_amount</code></td><td>Decimal</td><td></td></tr>
  <tr><td><code>tax_treatment</code></td><td>String</td><td></td></tr>
  <tr><td><code>confidence</code></td><td>Float</td><td></td></tr>
  <tr><td><code>risk_count</code></td><td>Integer</td><td></td></tr>
  <tr><td><code>reviewed_by</code></td><td>UUID (FK)</td><td></td></tr>
  <tr><td><code>reviewed_at</code></td><td>Datetime</td><td></td></tr>
  <tr><td><code>review_action</code></td><td>String</td><td></td></tr>
  <tr><td><code>signature_path</code></td><td>String</td><td></td></tr>
  <tr><td><code>signed_by</code></td><td>UUID (FK)</td><td></td></tr>
  <tr><td><code>signed_at</code></td><td>Datetime</td><td></td></tr>
  <tr><td><code>audit_client_email</code></td><td>String</td><td>Snapshot for audit integrity</td></tr>
  <tr><td><code>audit_company_name</code></td><td>String</td><td>Snapshot for audit integrity</td></tr>
  <tr><td><code>created_at</code></td><td>Datetime</td><td></td></tr>
  <tr><td><code>updated_at</code></td><td>Datetime</td><td></td></tr>
</table>

<p>
  <strong>Normalisation:</strong> 3NF with deliberate denormalisation — <code>audit_client_email</code> and <code>audit_company_name</code> are snapshots retained for historical accuracy even if the user updates their profile. <code>agent_result</code> (JSON) is denormalised by design as a read-heavy snapshot always read/written as a whole unit.
</p>

---

<h2 id="9-getting-started">9. 🚀 Getting Started</h2>

<h3>Prerequisites</h3>

<ul>
  <li>Node.js 18+</li>
  <li>Python 3.10+</li>
  <li>Docker & Docker Compose</li>
</ul>

<h3>1. Clone the Repository</h3>

<pre><code>git clone https://github.com/your-repo/taxmate.git
cd taxmate</code></pre>

<h3>2. Start the Database</h3>

<pre><code>docker-compose up -d</code></pre>

<h3>3. Backend Setup</h3>

<pre><code>cd backend
pip install -r requirements.txt
cp .env.example .env
# Configure: DATABASE_URL, ILMU_API_KEY, SMTP credentials
uvicorn main:app --reload --port 8000</code></pre>

<h3>4. Frontend Setup</h3>

<pre><code>cd frontend
npm install
npm run dev</code></pre>

<h3>5. Access the Application</h3>

<table>
  <tr><th>Service</th><th>URL</th></tr>
  <tr><td>Frontend</td><td><a href="http://localhost:5173">http://localhost:5173</a></td></tr>
  <tr><td>Backend API</td><td><a href="http://localhost:8000">http://localhost:8000</a></td></tr>
  <tr><td>API Docs</td><td><a href="http://localhost:8000/docs">http://localhost:8000/docs</a></td></tr>
</table>

<h3>Environment Variables</h3>

<table>
  <tr><th>Variable</th><th>Description</th></tr>
  <tr><td><code>DATABASE_URL</code></td><td>PostgreSQL connection string</td></tr>
  <tr><td><code>ILMU_API_KEY</code></td><td>Z.AI GLM API key</td></tr>
  <tr><td><code>ILMU_BASE_URL</code></td><td><code>https://api.ilmu.ai/anthropic</code></td></tr>
  <tr><td><code>ILMU_MODEL</code></td><td><code>ilmu-glm-5.1</code></td></tr>
  <tr><td><code>MAIL_USERNAME</code></td><td>SMTP username</td></tr>
  <tr><td><code>MAIL_PASSWORD</code></td><td>SMTP password</td></tr>
  <tr><td><code>MAIL_FROM</code></td><td>Sender email address</td></tr>
  <tr><td><code>MAIL_SERVER</code></td><td>SMTP server host</td></tr>
  <tr><td><code>MAIL_PORT</code></td><td>SMTP port</td></tr>
  <tr><td><code>SECRET_KEY</code></td><td>JWT signing secret</td></tr>
</table>

---

<h2 id="10-project-structure">10. 📁 Project Structure</h2>

<pre><code>taxmate/
├── backend/
│   ├── agents/                  # AI Agent implementations
│   │   ├── tax_agent.py         # Single-doc Tax Agent + Batch Analyzer
│   │   └── workflow_orchestrator.py  # 7-stage Workflow Orchestrator
│   ├── services/                # Business logic layer
│   │   ├── ocr_service.py       # PaddleOCR integration
│   │   ├── document_service.py  # Document CRUD operations
│   │   └── email_service.py     # Email delivery with AI content
│   ├── routers/                 # API endpoint definitions
│   ├── models/                  # SQLAlchemy ORM models
│   ├── schemas/                 # Pydantic request/response schemas
│   ├── templates/               # SST-02 PDF template (JKDM AcroForm)
│   ├── main.py                  # FastAPI application entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── owner/           # Owner interface pages
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Upload.tsx
│   │   │   │   ├── Documents.tsx
│   │   │   │   ├── TaxInsights.tsx
│   │   │   │   ├── Downloads.tsx
│   │   │   │   └── Profile.tsx
│   │   │   └── accountant/      # Accountant interface pages
│   │   │       ├── ClientList.tsx
│   │   │       ├── Workbench.tsx
│   │   │       ├── EfficiencySummary.tsx
│   │   │       └── Profile.tsx
│   │   ├── components/          # Shared React components
│   │   │   ├── SignaturePad.tsx
│   │   │   ├── AgentThinkingPanel.tsx
│   │   │   └── AIChatbot.tsx
│   │   ├── api/                 # Axios API client
│   │   ├── context/             # React context (auth, theme)
│   │   └── lib/                 # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md</code></pre>

---

<h2 id="11-api-endpoints">11. 🔌 API Endpoints</h2>

<h3>Authentication</h3>

<table>
  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
  <tr><td><code>POST</code></td><td><code>/api/auth/register</code></td><td>Register new user (owner/accountant)</td></tr>
  <tr><td><code>POST</code></td><td><code>/api/auth/login</code></td><td>Login and receive JWT token</td></tr>
</table>

<h3>Documents</h3>

<table>
  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
  <tr><td><code>POST</code></td><td><code>/api/documents/upload</code></td><td>Upload receipt (multipart/form-data) → triggers OCR + Tax Agent</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/documents</code></td><td>List documents (filterable by status, month, year)</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/documents/{id}</code></td><td>Get single document with AI results</td></tr>
  <tr><td><code>PUT</code></td><td><code>/api/documents/{id}/review</code></td><td>Accountant approves/rejects with optional field edits</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/documents/review-brief</code></td><td>AI-generated summary briefing for accountant</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/documents/batch-analysis</code></td><td>Cross-document batch analysis</td></tr>
  <tr><td><code>POST</code></td><td><code>/api/documents/sign-sst02</code></td><td>Digital sign-off → generates signed SST-02 PDF → emails owner</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/documents/draft-sst02</code></td><td>Generate/download draft SST-02 PDF</td></tr>
</table>

<h3>Workflow</h3>

<table>
  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
  <tr><td><code>POST</code></td><td><code>/api/documents/workflow/next-step</code></td><td>Orchestrator recommends next action</td></tr>
</table>

<h3>AI Chat</h3>

<table>
  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
  <tr><td><code>POST</code></td><td><code>/api/chat</code></td><td>Context-enriched AI Q&A for owners and accountants</td></tr>
</table>

<h3>Users</h3>

<table>
  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
  <tr><td><code>GET</code></td><td><code>/api/users/me</code></td><td>Get current user profile</td></tr>
  <tr><td><code>PUT</code></td><td><code>/api/users/me</code></td><td>Update profile</td></tr>
  <tr><td><code>GET</code></td><td><code>/api/users/clients</code></td><td>Accountant: list bound clients</td></tr>
</table>

---

<h2 id="12-team-members">12. 👥 Team Members</h2>

<table>
  <tr>
    <th>Member</th>
    <th>Role</th>
    <th>Responsibilities</th>
  </tr>
  <tr>
    <td><strong>Yap Li Shan</strong></td>
    <td>Backend Lead & AI Agent Architect</td>
    <td>FastAPI architecture · SQLAlchemy schema · Z.AI GLM integration · 3 AI Agents (Tax Agent, Batch Analyzer, Workflow Orchestrator) · OCR service (PaddleOCR) · SST-02 PDF filling (pypdf AcroForm) · Digital signature overlay (ReportLab) · Email service · JWT + bcrypt auth · Accountant matching logic</td>
  </tr>
  <tr>
    <td><strong>Chan Min Huey</strong></td>
    <td>Frontend Lead & Product Manager</td>
    <td>React 19 + TypeScript SPA · Owner & Accountant interfaces · SignaturePad canvas component · AI Chatbot floating widget · Axios API client with JWT interceptor · Responsive TailwindCSS styling · Demo preparation · Documentation coordination · Pitch deck design</td>
  </tr>
</table>

---

<p align="center">
  <strong>Built with ❤️ by Team 166_EyeScream for UMHackathon 2026</strong>
</p>
<p align="center">
  <em>"TaxMate doesn't replace the human — it gives them an AI engine that handles the grind, so they can focus on what matters."</em>
</p>
