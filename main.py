"""
Revit Automation Hub Backend
A complete FastAPI backend for managing Revit automation requests with AI analysis.
"""

import os
import time
import json
from datetime import datetime, timedelta
from typing import Optional, List
from base64 import b64decode
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, BigInteger
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr, ConfigDict
from passlib.context import CryptContext
from jose import JWTError, jwt
import google.generativeai as genai

# ============================================================================
# CONFIGURATION
# ============================================================================

SECRET_KEY = os.getenv("SECRET_KEY", "revit-hub-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
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
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # ARCHITECT or DEVELOPER
    avatar_url = Column(String, nullable=True)
    
    requests = relationship("Request", back_populates="requester")


class Request(Base):
    __tablename__ = "requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, nullable=False, default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, REJECTED
    project_name = Column(String, nullable=False)
    revit_version = Column(String, nullable=False)
    due_date = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    developer_notes = Column(Text, nullable=True)
    result_script = Column(Text, nullable=True)
    ai_analysis_json = Column(Text, nullable=True)
    
    requester = relationship("User", back_populates="requests")
    attachments = relationship("Attachment", back_populates="request", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    data_base64 = Column(Text, nullable=False)
    
    request = relationship("Request", back_populates="attachments")


# Create tables
Base.metadata.create_all(bind=engine)

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class AttachmentCreate(BaseModel):
    file_name: str
    file_type: str
    data_base64: str


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    file_name: str
    file_type: str
    data_base64: str


class RequestCreate(BaseModel):
    title: str
    description: str
    priority: str
    project_name: str
    revit_version: str
    due_date: Optional[int] = None
    attachments: List[AttachmentCreate] = []


class RequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    project_name: Optional[str] = None
    revit_version: Optional[str] = None
    due_date: Optional[int] = None
    developer_notes: Optional[str] = None
    result_script: Optional[str] = None
    ai_analysis_json: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    full_name: str
    role: str
    avatar_url: Optional[str] = None


class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    title: str
    description: str
    priority: str
    status: str
    project_name: str
    revit_version: str
    due_date: Optional[int] = None
    created_at: int
    updated_at: int
    requester_id: int
    developer_notes: Optional[str] = None
    result_script: Optional[str] = None
    ai_analysis_json: Optional[str] = None
    requester: UserResponse
    attachments: List[AttachmentResponse] = []


class Token(BaseModel):
    access_token: str
    token_type: str


# ============================================================================
# AUTHENTICATION
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


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
    if not user or not verify_password(password, user.hashed_password):
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
                email="arch@design.com",
                hashed_password=get_password_hash("revit"),
                full_name="Architecture Lead",
                role="ARCHITECT",
                avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=architect"
            )
            # Create developer
            developer = User(
                email="dev@code.com",
                hashed_password=get_password_hash("python"),
                full_name="Python Developer",
                role="DEVELOPER",
                avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=developer"
            )
            db.add(architect)
            db.add(developer)
            db.commit()
            print("✅ Database seeded with default users")
    finally:
        db.close()
    
    yield
    
    # Shutdown (cleanup if needed)
    print("🔴 Shutting down...")

app = FastAPI(title="Revit Automation Hub API", version="1.0.0", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# ROUTES - AUTHENTICATION
# ============================================================================

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
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
    return {"access_token": access_token, "token_type": "bearer"}


# ============================================================================
# ROUTES - USERS
# ============================================================================

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


# ============================================================================
# ROUTES - REQUESTS
# ============================================================================

@app.get("/requests", response_model=List[RequestResponse])
async def get_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "ARCHITECT":
        requests = db.query(Request).filter(Request.requester_id == current_user.id).all()
    else:  # DEVELOPER
        requests = db.query(Request).all()
    return requests


@app.post("/requests", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: RequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_time = int(time.time())
    
    new_request = Request(
        title=request_data.title,
        description=request_data.description,
        priority=request_data.priority,
        status="PENDING",
        project_name=request_data.project_name,
        revit_version=request_data.revit_version,
        due_date=request_data.due_date,
        created_at=current_time,
        updated_at=current_time,
        requester_id=current_user.id
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    # Add attachments
    for attachment_data in request_data.attachments:
        attachment = Attachment(
            request_id=new_request.id,
            file_name=attachment_data.file_name,
            file_type=attachment_data.file_type,
            data_base64=attachment_data.data_base64
        )
        db.add(attachment)
    
    db.commit()
    db.refresh(new_request)
    
    return new_request


@app.get("/requests/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Authorization check
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this request")
    
    return request_obj


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
    update_data = request_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request_obj, field, value)
    
    request_obj.updated_at = int(time.time())
    
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
        raise HTTPException(status_code=403, detail="Not authorized to delete this request")
    
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
    
    # Build the prompt
    system_prompt = f"""You are an expert Revit API Automation Engineer and Python Developer. 
Analyze the following automation request for Revit {request_obj.revit_version} in Project "{request_obj.project_name}".

REQUEST TITLE: {request_obj.title}
DESCRIPTION: {request_obj.description}

Your goal is to provide a JSON response with:
1. complexityScore: An integer 1-10.
2. suggestedNamespaces: A list of relevant Autodesk.Revit.DB namespaces.
3. implementationStrategy: A concise textual explanation of how to solve this.
4. pseudoCode: A pythonic pseudo-code snippet using the Revit API structure.

RETURN JSON ONLY."""
    
    try:
        # Prepare content parts
        content_parts = [system_prompt]
        
        # Add image attachments if any
        image_attachments = [att for att in request_obj.attachments if att.file_type.startswith("image/")]
        for attachment in image_attachments:
            try:
                # Gemini expects the base64 data and mime type
                content_parts.append({
                    "mime_type": attachment.file_type,
                    "data": attachment.data_base64
                })
            except Exception as e:
                print(f"Error processing image attachment: {e}")
        
        # Call Gemini API
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(content_parts)
        
        # Extract and parse JSON from response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON
        analysis_json = json.loads(response_text)
        
        # Save to database
        request_obj.ai_analysis_json = json.dumps(analysis_json)
        request_obj.updated_at = int(time.time())
        db.commit()
        
        return analysis_json
        
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
        "version": "1.0.0",
        "docs": "/docs"
    }


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)