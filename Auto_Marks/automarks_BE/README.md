# 📊 VTU Results Management System

**Automated VTU Result Extraction & Analysis Platform**

Extract, store, and analyze VTU student results from PDF documents using AI-powered extraction with **PostgreSQL** database.

---

## ✅ Current Status

- ✅ PostgreSQL-backed storage (production-grade)
- ✅ Fixed PDF extraction (extracts all 9 subjects)
- ✅ Uses `uv` for dependency management

---

## 🚀 Quick Start Guide

### 1️⃣ Prerequisites

- **Python 3.11** (recommended) or Python 3.10+
- **PostgreSQL 14+** installed and running
- **uv** (fast package installer)

### 2️⃣ PostgreSQL Setup (REQUIRED FIRST)

#### Install PostgreSQL

- **Ubuntu/Debian**: `sudo apt install postgresql postgresql-contrib`
- **macOS**: `brew install postgresql`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/)

#### Start PostgreSQL Service

```bash
# Linux:
sudo systemctl start postgresql

# macOS:
brew services start postgresql

# Windows: Runs automatically as a service
```

#### Create Database

```bash
# Connect to PostgreSQL (enter password when prompted)
psql -U postgres

# Inside psql prompt:
CREATE DATABASE vtu_results;
\q
```

### 3️⃣ Python Installation

**Install uv (if not already installed):**
```bash
pip install uv
```

### 4️⃣ Project Setup

**Clone and setup the project:**
```bash
# Clone the repository
git clone <repository-url>
cd Auto_Marks/automarks_BE

# Install all dependencies with uv
uv sync

# Start the application
uv run python run_api.py
```

**Alternative start command:**
```bash
uv run run-api
```

---

## 📋 API Endpoints

- **📖 API Documentation**: `http://localhost:8000/docs`
- **🏥 Health Check**: `GET /health`
- **📤 Upload Results**: `POST /upload/single` or `POST /upload/batch`
- **👤 Student Results**: `GET /students/{usn}`
- **📊 Analytics**: `GET /analytics/subject-stats/{semester}`
- **📥 Export**: `GET /export/excel` or `GET /export/csv`

---

## 🔧 Configuration

Create a `.env` file in the project root:

```env
# Database Configuration
DB_TYPE=postgresql

POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=vtu_results

# API Base URL for frontend
API_BASE_URL=http://localhost:8000

# Application Settings
APP_ENV=development
DEBUG=True
SECRET_KEY=vtu-results-secret-key-2025

# PDF Processing
USE_DOCLING=false
```

---

## 📚 College Server Deployment

For detailed deployment instructions on college servers, see: **[COLLEGE_DEPLOYMENT_GUIDE.md](COLLEGE_DEPLOYMENT_GUIDE.md)**

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (async web framework)
- **Database**: PostgreSQL 14+ with SQLAlchemy 2.0 ORM
- **PDF Processing**: Docling + PyPDF for robust extraction
- **Package Management**: uv (modern Python packaging)
- **Data Processing**: Pandas, NumPy
- **API Documentation**: Automatic OpenAPI/Swagger
- **Frontend**: React (Vite + TypeScript)
- **Environment**: Python 3.11+ with virtual environments

---

## 🗄️ Database Schema

The system uses PostgreSQL with the following tables:
- **students**: Student information (USN, name, batch, branch)
- **semesters**: Exam semester details (number, month, year)
- **subjects**: Subject codes, names, and credit values
- **results**: Individual subject results with marks, status, dates
- **upload_logs**: Batch upload tracking with real-time progress
- **notifications**: System notification log

All tables include proper indexes, foreign key relationships, and CHECK constraints.

### Running Schema Manually (Optional)

The application auto-creates tables on startup, but you can also run the schema manually:

```bash
psql -U postgres -d vtu_results -f sql/schema.sql
```

---

## 🏫 College Server Deployment

When deploying to a college server:

1. **Install PostgreSQL** on the server
2. **Create a dedicated database user**:
   ```sql
   CREATE USER vtu_user WITH PASSWORD 'secure_password_here';
   CREATE DATABASE vtu_results OWNER vtu_user;
   ```
3. **Update `.env`** with server credentials
4. **Deploy application** with proper firewall settings

---

## 📁 Project Structure

```
automarks_BE/
├── app/                    # FastAPI application
│   ├── main.py            # Main API endpoints
│   ├── database.py        # PostgreSQL configuration
│   ├── models.py          # SQLAlchemy ORM models
│   ├── schemas.py         # Pydantic validation schemas
│   └── services/          # Business logic
│       ├── extractor.py   # PDF extraction service
│       └── analyzer.py    # Analytics & export service
├── sql/
│   └── schema.sql         # PostgreSQL database schema
├── data/                  # Data processing directories
├── scripts/               # Utility & migration scripts
├── logs/                  # Application logs
├── requirements.txt       # Python dependencies
├── pyproject.toml         # Modern Python packaging
└── run_api.py             # Application entry point
```

---

## 🎯 Features

### ✅ Current Features
- **📤 Dynamic PDF Upload**: Single or batch upload (65+ PDFs supported)
- **🤖 AI-Powered Extraction**: Automatic data extraction using Docling / pypdf
- **💾 PostgreSQL Storage**: Production-grade, reliable storage
- **📊 Analytics Dashboard**: Subject-wise, semester-wise analysis with GPA
- **📥 Export Options**: Excel (styled), CSV formats
- **🔍 Search & Filter**: By USN, name, semester, subject, batch, branch
- **🔄 Real-time Updates**: WebSocket-based upload progress
- **🔔 Notifications**: System-wide notification log
- **🧹 Admin Purge**: Safe record deletion with confirmation

---

## 📋 Usage Examples

### API Mode
```bash
# Start API server
python run_api.py

# Upload PDF via API
curl -X POST "http://localhost:8000/upload/single" \
  -F "file=@VTU_Result_2025.pdf" \
  -F "batch=2022-2026"

# Get student results
curl "http://localhost:8000/students/1SV22AD005"

# Get subject statistics
curl "http://localhost:8000/analytics/subject-stats/5"
```

---

## 🔧 Troubleshooting

- **PostgreSQL connection fails?** Check service is running: `sudo systemctl status postgresql`
- **Password issues?** Verify password in `.env` matches PostgreSQL user password
- **Port blocked?** Ensure port 5432 is open in firewall
- **Permission denied?** Check PostgreSQL user permissions
- **Module not found?** Run: `pip install -r requirements.txt`

---

## 📦 Dependencies

### Core
- **FastAPI** + **Uvicorn**: API server
- **Docling / pypdf**: PDF extraction
- **SQLAlchemy 2.0**: Database ORM
- **Pandas / NumPy**: Data manipulation

### Database
- **psycopg2-binary**: PostgreSQL driver

### Utilities
- **python-dotenv**: Environment variables
- **openpyxl**: Excel export

---

## 🎯 Roadmap

- [x] PDF extraction with Docling
- [x] PostgreSQL support (production-grade)
- [x] FastAPI backend
- [x] Batch processing (65+ PDFs)
- [x] Analytics dashboard
- [x] Export to Excel/CSV
- [x] WebSocket real-time updates
- [x] GPA/SGPA/CGPA calculations
- [ ] Authentication system
- [ ] Email notifications
- [ ] Docker containerization
- [ ] Mobile responsive UI

---

## 📄 License

This project is for educational purposes.

---

**Made for VTU Students**
