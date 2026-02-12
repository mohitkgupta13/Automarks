# College Deployment Guide — VTU Results System

This guide provides step-by-step instructions to deploy the VTU Results Extraction and Management System on a college server using **PostgreSQL**.

## Prerequisites

- **Python**: 3.11 or higher
- **PostgreSQL**: 14 or higher
- **pip / uv**: Package manager for Python dependencies
- **Git**: Version control

## Step-by-Step Setup

### 1. Install Prerequisites

1. **Python 3.11+**: Download from [python.org](https://www.python.org/downloads/)
2. **PostgreSQL 14+**: Download from [postgresql.org](https://www.postgresql.org/download/)
   - During installation, note the password you set for the `postgres` user.

### 2. Clone the Repository

```bash
git clone https://github.com/ANJAN672/Auto_Marks.git
cd Auto_Marks/automarks_BE
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or using **uv** (faster):

```bash
uv sync
```

### 4. Set Up PostgreSQL Database

#### Option A: Using psql (Command Line)

1. Open a terminal and connect to PostgreSQL:

```bash
psql -U postgres
```

2. Create the database:

```sql
CREATE DATABASE vtu_results;
\q
```

3. (Optional) Run the schema script:

```bash
psql -U postgres -d vtu_results -f sql/schema.sql
```

> **Note:** The application auto-creates tables on first startup via SQLAlchemy, so step 3 is optional.

#### Option B: Using pgAdmin

1. Open pgAdmin and connect to your local PostgreSQL server.
2. Right-click on **Databases** → **Create** → **Database…**
3. Enter `vtu_results` as the database name and click **Save**.

### 5. Configure Environment Variables

Edit the `.env` file in the project root:

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
APP_ENV=production
DEBUG=False
SECRET_KEY=change-this-to-a-random-string
```

### 6. Run the Application

```bash
python run_api.py
```

Or directly with uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API opens at: `http://localhost:8000`  
Interactive docs at: `http://localhost:8000/docs`

---

## Troubleshooting

#### 1. PostgreSQL Connection Error

**Error**: `could not connect to server: Connection refused`

- Ensure the PostgreSQL service is running:
  - **Linux**: `sudo systemctl start postgresql`
  - **Windows**: Start "PostgreSQL" from Windows Services
  - **macOS**: `brew services start postgresql`
- Check that the credentials in `.env` match your PostgreSQL setup.
- Verify PostgreSQL port (default: 5432).

#### 2. Database Does Not Exist

**Error**: `database "vtu_results" does not exist`

- Create the database manually:

```bash
psql -U postgres -c "CREATE DATABASE vtu_results;"
```

#### 3. Permission Denied

**Error**: `password authentication failed for user "postgres"`

- Verify the password in `.env` matches your installation.
- Consider creating a dedicated application user:

```sql
CREATE USER vtu_app WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE vtu_results TO vtu_app;
-- After connecting to the vtu_results database:
GRANT ALL ON SCHEMA public TO vtu_app;
```

#### 4. Port Conflict

If port 8000 is in use:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

---

## Security Recommendations

1. **Change Default Passwords**: Use a strong password for the `postgres` user.
2. **Use a Dedicated DB User**: Don't run the application as `postgres` superuser.
3. **Enable SSL**: Configure PostgreSQL for SSL connections in production.
4. **Firewall**: Only expose port 5432 to the application server, not the internet.
5. **Environment Variables**: Never commit `.env` files with real credentials.

## Backup & Restore

### Backup

```bash
pg_dump -U postgres vtu_results > backup.sql
```

### Restore

```bash
psql -U postgres vtu_results < backup.sql
```

---

## Architecture Summary

| Component     | Technology     |
|---------------|----------------|
| Backend       | FastAPI + Python |
| Database      | PostgreSQL 14+ |
| ORM           | SQLAlchemy 2.0 |
| PDF Extraction| Docling / pypdf |
| Data Analysis | Pandas + NumPy |
| Frontend      | React (Vite)   |

### Features

- ✅ AI-powered PDF extraction (VTU results)
- ✅ PostgreSQL-backed storage (production-grade)
- ✅ Real-time WebSocket progress tracking
- ✅ Subject-wise analytics & GPA calculations
- ✅ Excel/CSV export
- ✅ Batch upload with thread pool processing
- ✅ Admin purge endpoints with confirmation
- ✅ Notification system