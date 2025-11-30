"""
Revit Automation Hub Backend
A complete FastAPI backend for managing Revit automation requests with AI analysis.
Updated to match frontend requirements including user management and file uploads.
"""

import os
import time
import json
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, BigInteger
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from passlib.context import CryptContext
from jose import JWTError, jwt
import google.generativeai as genai

# ============================================================================
# CONFIGURATION
# ============================================================================

SECRET_KEY = os.getenv("SECRET_KEY", "revit-hub-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
GEMINI_API_KEY = os.getenv("API_KEY")

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ============================================================================
# DATABASE SETUP
# ============================================================================

DATABASE_URL = "sqlite:///./revithub.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # Hashed
    role = Column(String, nullable=False)  # ARCHITECT or DEVELOPER
    avatar = Column(String, nullable=True)
    
    requests = relationship("Request", back_populates="requester", foreign_keys="Request.requester_id")


class Request(Base):
    __tablename__ = "requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="PENDING")
    priority = Column(String, nullable=False)
    project_name = Column(String, nullable=False)
    revit_version = Column(String, nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requester_name = Column(String, nullable=False)  # Cached for performance
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    due_date = Column(String, nullable=True)  # ISO Date string
    result_script = Column(Text, nullable=True)
    result_file_name = Column(String, nullable=True)
    ai_analysis = Column(Text, nullable=True)  # JSON string
    developer_notes = Column(Text, nullable=True)
    
    requester = relationship("User", back_populates="requests", foreign_keys=[requester_id])
    attachments = relationship("Attachment", back_populates="request", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # MimeType
    data = Column(Text, nullable=False)  # Base64 string
    
    request = relationship("Request", back_populates="attachments")


# Create tables
Base.metadata.create_all(bind=engine)

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class AttachmentCreate(BaseModel):
    name: str
    type: str
    data: str


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    type: str
    data: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    email: str
    role: str
    avatar: Optional[str] = None


class RequestCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    title: str
    description: str
    status: str = "PENDING"
    priority: str
    project_name: str = Field(..., alias="projectName")
    revit_version: str = Field(..., alias="revitVersion")
    requester_id: int = Field(..., alias="requesterId")
    requester_name: str = Field(..., alias="requesterName")
    due_date: Optional[str] = Field(None, alias="dueDate")
    attachments: List[AttachmentCreate] = []


class RequestUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    project_name: Optional[str] = Field(None, alias="projectName")
    revit_version: Optional[str] = Field(None, alias="revitVersion")
    due_date: Optional[str] = Field(None, alias="dueDate")
    result_script: Optional[str] = Field(None, alias="resultScript")
    result_file_name: Optional[str] = Field(None, alias="resultFileName")
    ai_analysis: Optional[str] = Field(None, alias="aiAnalysis")
    developer_notes: Optional[str] = Field(None, alias="developerNotes")


class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    title: str
    description: str
    status: str
    priority: str
    project_name: str = Field(..., alias="projectName", serialization_alias="projectName")
    revit_version: str = Field(..., alias="revitVersion", serialization_alias="revitVersion")
    requester_id: int = Field(..., alias="requesterId", serialization_alias="requesterId")
    requester_name: str = Field(..., alias="requesterName", serialization_alias="requesterName")
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")
    updated_at: int = Field(..., alias="updatedAt", serialization_alias="updatedAt")
    due_date: Optional[str] = Field(None, alias="dueDate", serialization_alias="dueDate")
    result_script: Optional[str] = Field(None, alias="resultScript", serialization_alias="resultScript")
    result_file_name: Optional[str] = Field(None, alias="resultFileName", serialization_alias="resultFileName")
    ai_analysis: Optional[str] = Field(None, alias="aiAnalysis", serialization_alias="aiAnalysis")
    developer_notes: Optional[str] = Field(None, alias="developerNotes", serialization_alias="developerNotes")
    requester: UserResponse
    attachments: List[AttachmentResponse] = []


class LoginRequest(BaseModel):
    username: str  # email
    password: str


class LoginResponse(BaseModel):
    access_token: str
    user: UserResponse


class Token(BaseModel):
    access_token: str
    token_type: str


# ============================================================================
# AUTHENTICATION
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password):
        return False
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_developer(current_user: User = Depends(get_current_user)):
    if current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only developers can access this resource"
        )
    return current_user


# ============================================================================
# FASTAPI APP
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            # Create architect
            architect = User(
                name="Architecture Lead",
                email="arch@design.com",
                password=get_password_hash("revit"),
                role="ARCHITECT",
                avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=architect"
            )
            # Create developer
            developer = User(
                name="Python Developer",
                email="dev@code.com",
                password=get_password_hash("python"),
                role="DEVELOPER",
                avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=developer"
            )
            db.add(architect)
            db.add(developer)
            db.commit()
            print("✅ Database seeded with default users")
            print("   - Architect: arch@design.com / revit")
            print("   - Developer: dev@code.com / python")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    print("🔴 Shutting down...")

app = FastAPI(title="Revit Automation Hub API", version="2.0.0", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# ROUTES - AUTHENTICATION
# ============================================================================

@app.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


# ============================================================================
# ROUTES - USER MANAGEMENT
# ============================================================================

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@app.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Generate avatar URL based on name
    avatar_seed = user_data.name.lower().replace(" ", "")
    avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={avatar_seed}"
    
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password=get_password_hash(user_data.password),
        role=user_data.role,
        avatar=avatar_url
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(user)
    db.commit()
    
    return None


# ============================================================================
# ROUTES - REQUEST MANAGEMENT
# ============================================================================

@app.get("/requests", response_model=List[RequestResponse])
async def list_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Request)
    
    # Architects only see their own requests
    if current_user.role == "ARCHITECT":
        query = query.filter(Request.requester_id == current_user.id)
    
    # Optional status filter (for Scripts Library - COMPLETED requests)
    if status:
        query = query.filter(Request.status == status)
    
    requests = query.order_by(Request.created_at.desc()).all()
    return requests


@app.get("/requests/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Authorization check for architects
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view this request"
        )
    
    return request_obj


@app.post("/requests", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: RequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_time = int(time.time() * 1000)  # Milliseconds
    
    new_request = Request(
        title=request_data.title,
        description=request_data.description,
        status=request_data.status,
        priority=request_data.priority,
        project_name=request_data.project_name,
        revit_version=request_data.revit_version,
        requester_id=request_data.requester_id,
        requester_name=request_data.requester_name,
        due_date=request_data.due_date,
        created_at=current_time,
        updated_at=current_time
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    # Add attachments
    for attachment_data in request_data.attachments:
        attachment = Attachment(
            request_id=new_request.id,
            name=attachment_data.name,
            type=attachment_data.type,
            data=attachment_data.data
        )
        db.add(attachment)
    
    db.commit()
    db.refresh(new_request)
    
    return new_request


@app.put("/requests/{request_id}", response_model=RequestResponse)
async def update_request(
    request_id: int,
    request_update: RequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update fields
    update_data = request_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request_obj, field, value)
    
    request_obj.updated_at = int(time.time() * 1000)
    
    db.commit()
    db.refresh(request_obj)
    
    return request_obj


@app.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Authorization check
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this request"
        )
    
    db.delete(request_obj)
    db.commit()
    
    return None


# ============================================================================
# ROUTES - AI ANALYSIS
# ============================================================================

@app.post("/requests/{request_id}/analyze")
async def analyze_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key not configured. Set API_KEY environment variable."
        )
    
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Build the analysis prompt
    system_prompt = f"""You are an expert Revit API Automation Engineer and Python Developer.
Analyze the following automation request for Revit {request_obj.revit_version} in Project "{request_obj.project_name}".

REQUEST TITLE: {request_obj.title}
DESCRIPTION: {request_obj.description}
PRIORITY: {request_obj.priority}

Provide a detailed technical analysis in JSON format with these exact fields:
1. complexityScore: An integer from 1-10 (1=trivial, 10=extremely complex)
2. suggestedNamespaces: Array of relevant Autodesk.Revit.DB namespaces (e.g., ["Autodesk.Revit.DB", "Autodesk.Revit.DB.Architecture"])
3. implementationStrategy: A concise 2-3 paragraph explanation of the approach
4. pseudoCode: Python-like pseudo-code showing the general structure using Revit API patterns

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object."""
    
    try:
        # Prepare content for Gemini
        content_parts = [system_prompt]
        
        # Add image attachments if any
        image_attachments = [att for att in request_obj.attachments if att.type.startswith("image/")]
        for attachment in image_attachments:
            try:
                content_parts.append({
                    "mime_type": attachment.type,
                    "data": attachment.data
                })
            except Exception as e:
                print(f"Warning: Could not process image attachment: {e}")
        
        # Call Gemini API
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(content_parts)
        
        # Extract and clean JSON response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse and validate JSON
        analysis_result = json.loads(response_text)
        
        # Validate required fields
        required_fields = ["complexityScore", "suggestedNamespaces", "implementationStrategy", "pseudoCode"]
        for field in required_fields:
            if field not in analysis_result:
                raise ValueError(f"Missing required field: {field}")
        
        # Save to database
        request_obj.ai_analysis = json.dumps(analysis_result)
        request_obj.updated_at = int(time.time() * 1000)
        db.commit()
        
        return analysis_result
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse AI response as JSON: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "Revit Automation Hub API",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "auth": "/auth/login",
            "users": "/users",
            "requests": "/requests"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": int(time.time())}


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting Revit Automation Hub Backend...")
    print("📍 API will be available at: http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔐 CORS enabled for: http://localhost:5173\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)