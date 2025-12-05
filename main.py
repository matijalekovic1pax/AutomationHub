"""
Revit Automation Hub Backend
Enhanced with: Registration Requests, Multiple File Uploads, Script Folders
"""

import os
import time
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from collections import defaultdict
from contextlib import asynccontextmanager

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, BigInteger, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship, joinedload
from pydantic import BaseModel, EmailStr, ConfigDict, Field, computed_field
from passlib.context import CryptContext
from jose import JWTError, jwt
import google.generativeai as genai

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "revit-hub-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
GEMINI_API_KEY = os.getenv("API_KEY")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@revithub.com")
DEFAULT_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@revithub.com")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Database Setup
DATABASE_URL = "sqlite:///./revithub.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    
    requests = relationship("Request", back_populates="requester", foreign_keys="Request.requester_id")


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    password = Column(String, nullable=False)  # Hashed
    status = Column(String, nullable=False, default="PENDING")  # PENDING, APPROVED, REJECTED
    created_at = Column(BigInteger, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(BigInteger, nullable=True)


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
    requester_name = Column(String, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    due_date = Column(String, nullable=True)
    result_script = Column(Text, nullable=True)
    result_file_name = Column(String, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    developer_notes = Column(Text, nullable=True)
    
    requester = relationship("User", back_populates="requests", foreign_keys=[requester_id])
    attachments = relationship("Attachment", back_populates="request", cascade="all, delete-orphan")
    result_files = relationship("ResultFile", back_populates="request", cascade="all, delete-orphan")
    folder_items = relationship("ScriptFolderItem", back_populates="request", cascade="all, delete-orphan")
    submission_events = relationship("SubmissionEvent", back_populates="request", cascade="all, delete-orphan", order_by="SubmissionEvent.created_at")
    comments = relationship("Comment", back_populates="request", cascade="all, delete-orphan", order_by="Comment.created_at")

    @property
    def submission_count(self) -> int:
        return len(self.submission_events or [])


class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    data = Column(Text, nullable=False)
    
    request = relationship("Request", back_populates="attachments")


class ResultFile(Base):
    __tablename__ = "result_files"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    data = Column(Text, nullable=False)
    
    request = relationship("Request", back_populates="result_files")


class SubmissionEvent(Base):
    __tablename__ = "submission_events"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    event_type = Column(String, nullable=False)  # SUBMISSION | RESUBMISSION
    created_at = Column(BigInteger, nullable=False)
    added_files = Column(Integer, nullable=False, default=0)
    
    request = relationship("Request", back_populates="submission_events")


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    
    request = relationship("Request", back_populates="comments")


class ScriptFolder(Base):
    __tablename__ = "script_folders"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True, default="#6366f1")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(BigInteger, nullable=False)
    
    items = relationship("ScriptFolderItem", back_populates="folder", cascade="all, delete-orphan")


class ScriptFolderItem(Base):
    __tablename__ = "script_folder_items"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    folder_id = Column(Integer, ForeignKey("script_folders.id"), nullable=False)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    
    folder = relationship("ScriptFolder", back_populates="items")
    request = relationship("Request", back_populates="folder_items")


class ScriptNode(Base):
    __tablename__ = "script_nodes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # FOLDER | FILE
    parent_id = Column(Integer, ForeignKey("script_nodes.id"), nullable=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    parent = relationship("ScriptNode", remote_side=[id], backref="children")
    request = relationship("Request")


Base.metadata.create_all(bind=engine)

# Pydantic Schemas
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


class ResultFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    type: str
    data: str


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    request_id: int = Field(..., alias="requestId", serialization_alias="requestId")
    user_id: Optional[int] = Field(None, alias="userId", serialization_alias="userId")
    author_name: str = Field(..., alias="authorName", serialization_alias="authorName")
    content: str
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")


class SubmissionEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    request_id: int = Field(..., alias="requestId", serialization_alias="requestId")
    event_type: str = Field(..., alias="eventType", serialization_alias="eventType")
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")
    added_files: int = Field(..., alias="addedFiles", serialization_alias="addedFiles")


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


class RegistrationRequestCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class RegistrationRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    name: str
    email: str
    status: str
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")
    reviewed_by: Optional[int] = Field(None, alias="reviewedBy", serialization_alias="reviewedBy")
    reviewed_at: Optional[int] = Field(None, alias="reviewedAt", serialization_alias="reviewedAt")


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
    result_files: List[ResultFileResponse] = Field([], alias="resultFiles", serialization_alias="resultFiles")
    submission_events: List[SubmissionEventResponse] = Field([], alias="submissionEvents", serialization_alias="submissionEvents")
    comments: List[CommentResponse] = Field([], alias="comments", serialization_alias="comments")

    @computed_field(return_type=int, alias="submissionCount")
    def submission_count(self) -> int:
        return len(self.submission_events or [])


class ScriptFolderCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"


class ScriptFolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    name: str
    description: Optional[str] = None
    color: str
    created_by: int = Field(..., alias="createdBy", serialization_alias="createdBy")
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")


class ScriptNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    name: str
    type: str
    parent_id: Optional[int] = Field(None, alias="parentId", serialization_alias="parentId")
    request_id: Optional[int] = Field(None, alias="requestId", serialization_alias="requestId")
    created_at: int = Field(..., alias="createdAt", serialization_alias="createdAt")
    updated_at: int = Field(..., alias="updatedAt", serialization_alias="updatedAt")
    children: List["ScriptNodeResponse"] = []
    request: Optional[RequestResponse] = None


class ScriptFolderNodeCreate(BaseModel):
    name: str
    parent_id: Optional[int] = Field(None, alias="parentId")


class ScriptFileCreate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = Field(None, alias="parentId")
    request_id: int = Field(..., alias="requestId")


class ScriptNodeUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = Field(None, alias="parentId")


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    user: UserResponse


class EmailNotification(BaseModel):
    subject: str
    body: str
    to: Optional[str] = None


ScriptNodeResponse.model_rebuild()


# Authentication
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


def ensure_root_script_folder(db: Session, current_user: Optional[User] = None) -> ScriptNode:
    root = db.query(ScriptNode).filter(ScriptNode.parent_id.is_(None)).first()
    if not root:
        now = int(time.time() * 1000)
        root = ScriptNode(
            name="Scripts",
            type="FOLDER",
            parent_id=None,
            request_id=None,
            created_by=current_user.id if current_user else 0,
            created_at=now,
            updated_at=now
        )
        db.add(root)
        db.commit()
        db.refresh(root)
    return root


def ensure_unsorted_script_folder(db: Session, root: ScriptNode, current_user: Optional[User] = None) -> ScriptNode:
    unsorted = db.query(ScriptNode).filter(
        ScriptNode.parent_id == root.id,
        ScriptNode.type == "FOLDER",
        ScriptNode.name == "Unsorted"
    ).first()
    if not unsorted:
        now = int(time.time() * 1000)
        unsorted = ScriptNode(
            name="Unsorted",
            type="FOLDER",
            parent_id=root.id,
            request_id=None,
            created_by=current_user.id if current_user else 0,
            created_at=now,
            updated_at=now
        )
        db.add(unsorted)
        db.commit()
        db.refresh(unsorted)
    return unsorted


def sync_completed_requests_into_tree(db: Session, created_by: Optional[User], root: ScriptNode):
    unsorted = ensure_unsorted_script_folder(db, root, created_by)
    completed_requests = db.query(Request).options(joinedload(Request.result_files)).filter(Request.status == "COMPLETED").all()
    now = int(time.time() * 1000)

    for req in completed_requests:
        # Ensure a folder exists for this request
        folder = db.query(ScriptNode).filter(
            ScriptNode.type == "FOLDER",
            ScriptNode.request_id == req.id
        ).first()
        if not folder:
            folder = ScriptNode(
                name=req.title,
                type="FOLDER",
                parent_id=unsorted.id,
                request_id=req.id,
                created_by=created_by.id if created_by else 0,
                created_at=now,
                updated_at=now
            )
            db.add(folder)
            db.commit()
            db.refresh(folder)
        # Keep folder under root hierarchy
        if folder.parent_id is None:
            folder.parent_id = unsorted.id
            folder.updated_at = now
            db.commit()

        existing_files = {
            node.name: node for node in db.query(ScriptNode).filter(
                ScriptNode.parent_id == folder.id,
                ScriptNode.type == "FILE"
            ).all()
        }
        for rf in req.result_files or []:
            if rf.name not in existing_files:
                new_file = ScriptNode(
                    name=rf.name,
                    type="FILE",
                    parent_id=folder.id,
                    request_id=req.id,
                    created_by=created_by.id if created_by else 0,
                    created_at=now,
                    updated_at=now
                )
                db.add(new_file)
        db.commit()


def build_script_tree(nodes: List[ScriptNode]) -> List[ScriptNodeResponse]:
    children_map: Dict[Optional[int], List[ScriptNode]] = defaultdict(list)
    for node in nodes:
        children_map[node.parent_id].append(node)

    for child_list in children_map.values():
        child_list.sort(key=lambda n: (0 if n.type == "FOLDER" else 1, n.name.lower()))

    def serialize(node: ScriptNode) -> ScriptNodeResponse:
        return ScriptNodeResponse(
            id=node.id,
            name=node.name,
            type=node.type,
            parent_id=node.parent_id,
            request_id=node.request_id,
            created_at=node.created_at,
            updated_at=node.updated_at,
            children=[serialize(child) for child in children_map.get(node.id, [])],
            request=RequestResponse.model_validate(node.request) if node.request else None
        )

    return [serialize(node) for node in children_map.get(None, [])]


def get_folder_or_404(db: Session, folder_id: int) -> ScriptNode:
    folder = db.query(ScriptNode).filter(ScriptNode.id == folder_id, ScriptNode.type == "FOLDER").first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


# FastAPI App
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            architect = User(
                name="Architecture Lead",
                email="arch@design.com",
                password=get_password_hash("revit"),
                role="ARCHITECT",
                avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=architect"
            )
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
    finally:
        db.close()
    
    yield
    print("🔴 Shutting down...")

app = FastAPI(title="Revit Automation Hub API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Wide open for local/dev; tokens are sent via Authorization header, not cookies.
    allow_origins=["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Routes - Authentication
@app.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


# Routes - Registration Requests
@app.post("/auth/register", response_model=RegistrationRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_registration_request(
    registration_data: RegistrationRequestCreate,
    db: Session = Depends(get_db)
):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == registration_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if there's already a pending request
    existing_request = db.query(RegistrationRequest).filter(
        RegistrationRequest.email == registration_data.email,
        RegistrationRequest.status == "PENDING"
    ).first()
    if existing_request:
        raise HTTPException(status_code=400, detail="Registration request already pending")
    
    new_request = RegistrationRequest(
        name=registration_data.name,
        email=registration_data.email,
        password=get_password_hash(registration_data.password),
        status="PENDING",
        created_at=int(time.time() * 1000)
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return new_request


@app.get("/registration-requests", response_model=List[RegistrationRequestResponse])
async def list_registration_requests(
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    requests = db.query(RegistrationRequest).order_by(RegistrationRequest.created_at.desc()).all()
    return requests


@app.post("/registration-requests/{request_id}/approve", response_model=UserResponse)
async def approve_registration_request(
    request_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    reg_request = db.query(RegistrationRequest).filter(RegistrationRequest.id == request_id).first()
    if not reg_request:
        raise HTTPException(status_code=404, detail="Registration request not found")
    
    if reg_request.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Create user
    avatar_seed = reg_request.name.lower().replace(" ", "")
    new_user = User(
        name=reg_request.name,
        email=reg_request.email,
        password=reg_request.password,  # Already hashed
        role="ARCHITECT",  # New users are architects by default
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={avatar_seed}"
    )
    
    db.add(new_user)
    
    # Update request
    reg_request.status = "APPROVED"
    reg_request.reviewed_by = current_user.id
    reg_request.reviewed_at = int(time.time() * 1000)
    
    db.commit()
    db.refresh(new_user)
    
    return new_user


@app.post("/registration-requests/{request_id}/reject")
async def reject_registration_request(
    request_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    reg_request = db.query(RegistrationRequest).filter(RegistrationRequest.id == request_id).first()
    if not reg_request:
        raise HTTPException(status_code=404, detail="Registration request not found")
    
    if reg_request.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    reg_request.status = "REJECTED"
    reg_request.reviewed_by = current_user.id
    reg_request.reviewed_at = int(time.time() * 1000)
    
    db.commit()
    
    return {"status": "rejected"}


# Routes - User Management
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
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Delete requests created by this user (and associated script nodes)
    user_requests = db.query(Request).filter(Request.requester_id == user.id).all()

    def delete_node_recursive(node: ScriptNode):
        children = db.query(ScriptNode).filter(ScriptNode.parent_id == node.id).all()
        for child in children:
            delete_node_recursive(child)
        db.delete(node)

    for req in user_requests:
        linked_nodes = db.query(ScriptNode).filter(ScriptNode.request_id == req.id).all()
        for node in linked_nodes:
            delete_node_recursive(node)
        db.delete(req)

    db.delete(user)
    db.commit()

    return None


# Routes - Request Management
@app.get("/requests", response_model=List[RequestResponse])
async def list_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Request).options(
        joinedload(Request.attachments),
        joinedload(Request.result_files),
        joinedload(Request.submission_events)
    )
    
    if current_user.role == "ARCHITECT":
        query = query.filter(Request.requester_id == current_user.id)
    
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
    request_obj = db.query(Request).options(
        joinedload(Request.attachments),
        joinedload(Request.result_files),
        joinedload(Request.submission_events),
        joinedload(Request.comments)
    ).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return request_obj


@app.post("/requests", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: RequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_time = int(time.time() * 1000)
    
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
    
    update_data = request_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request_obj, field, value)
    
    request_obj.updated_at = int(time.time() * 1000)
    
    db.commit()
    db.refresh(request_obj)
    
    return request_obj


@app.post("/requests/{request_id}/result-files")
async def add_result_files(
    request_id: int,
    files: List[AttachmentCreate],
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    now_ms = int(time.time() * 1000)
    for file_data in files:
        result_file = ResultFile(
            request_id=request_id,
            name=file_data.name,
            type=file_data.type,
            data=file_data.data
        )
        db.add(result_file)
    
    event_type = "SUBMISSION" if len(request_obj.submission_events or []) == 0 else "RESUBMISSION"
    event = SubmissionEvent(
        request_id=request_id,
        event_type=event_type,
        created_at=now_ms,
        added_files=len(files)
    )
    db.add(event)
    request_obj.updated_at = now_ms
    
    db.commit()
    db.refresh(request_obj)
    
    return {"status": "success", "count": len(files), "eventType": event_type}


@app.delete("/requests/{request_id}/result-files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_result_file(
    request_id: int,
    file_id: int,
    name: Optional[str] = None,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).options(joinedload(Request.result_files)).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    target = None
    for rf in request_obj.result_files:
        if rf.id == file_id or (name and rf.name == name):
            target = rf
            break
    if not target:
        raise HTTPException(status_code=404, detail="Result file not found for this request")
    
    now_ms = int(time.time() * 1000)
    request_obj.updated_at = now_ms
    
    db.delete(target)
    db.commit()
    
    return None


# Routes - Script Folders
@app.get("/script-folders", response_model=List[ScriptFolderResponse])
async def list_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    folders = db.query(ScriptFolder).order_by(ScriptFolder.created_at.desc()).all()
    return folders


@app.post("/script-folders", response_model=ScriptFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_data: ScriptFolderCreate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    new_folder = ScriptFolder(
        name=folder_data.name,
        description=folder_data.description,
        color=folder_data.color,
        created_by=current_user.id,
        created_at=int(time.time() * 1000)
    )
    
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    
    return new_folder


@app.post("/script-folders/{folder_id}/add-request/{request_id}")
async def add_request_to_folder(
    folder_id: int,
    request_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    folder = db.query(ScriptFolder).filter(ScriptFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if already in folder
    existing = db.query(ScriptFolderItem).filter(
        ScriptFolderItem.folder_id == folder_id,
        ScriptFolderItem.request_id == request_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Request already in folder")
    
    item = ScriptFolderItem(folder_id=folder_id, request_id=request_id)
    db.add(item)
    db.commit()
    
    return {"status": "added"}


@app.delete("/script-folders/{folder_id}/remove-request/{request_id}")
async def remove_request_from_folder(
    folder_id: int,
    request_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    item = db.query(ScriptFolderItem).filter(
        ScriptFolderItem.folder_id == folder_id,
        ScriptFolderItem.request_id == request_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in folder")
    
    db.delete(item)
    db.commit()
    
    return {"status": "removed"}


@app.get("/script-folders/{folder_id}/requests", response_model=List[RequestResponse])
async def get_folder_requests(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    folder = db.query(ScriptFolder).filter(ScriptFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    request_ids = [item.request_id for item in folder.items]
    requests = db.query(Request).filter(Request.id.in_(request_ids)).all()
    
    return requests


@app.delete("/script-folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    folder = db.query(ScriptFolder).filter(ScriptFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db.delete(folder)
    db.commit()
    
    return None


# Routes - Script Tree (Nested, role-aware)
@app.get("/script-tree", response_model=List[ScriptNodeResponse])
async def list_script_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    root = ensure_root_script_folder(db, current_user)
    sync_completed_requests_into_tree(db, current_user, root)
    nodes = db.query(ScriptNode).all()
    return build_script_tree(nodes)


@app.post("/script-tree/folder", response_model=ScriptNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_script_tree_folder(
    folder_data: ScriptFolderNodeCreate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    root = ensure_root_script_folder(db, current_user)
    parent = get_folder_or_404(db, folder_data.parent_id or root.id)
    
    now = int(time.time() * 1000)
    node = ScriptNode(
        name=folder_data.name,
        type="FOLDER",
        parent_id=parent.id,
        request_id=None,
        created_by=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@app.post("/script-tree/file", response_model=ScriptNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_script_file_link(
    file_data: ScriptFileCreate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    root = ensure_root_script_folder(db, current_user)
    parent = get_folder_or_404(db, file_data.parent_id or root.id)
    request_obj = db.query(Request).filter(Request.id == file_data.request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    existing = db.query(ScriptNode).filter(
        ScriptNode.type == "FILE",
        ScriptNode.parent_id == parent.id,
        ScriptNode.request_id == request_obj.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Script already linked in this folder")

    now = int(time.time() * 1000)
    node = ScriptNode(
        name=file_data.name or request_obj.title,
        type="FILE",
        parent_id=parent.id,
        request_id=request_obj.id,
        created_by=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@app.put("/script-tree/{node_id}", response_model=ScriptNodeResponse)
async def update_script_node(
    node_id: int,
    node_update: ScriptNodeUpdate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    node = db.query(ScriptNode).filter(ScriptNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.parent_id is None:
        raise HTTPException(status_code=400, detail="Root folder cannot be modified")

    if node_update.parent_id is not None:
        new_parent = get_folder_or_404(db, node_update.parent_id)
        cursor = new_parent
        while cursor:
            if cursor.id == node.id:
                raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
            cursor = cursor.parent
        node.parent_id = new_parent.id

    if node_update.name:
        node.name = node_update.name

    node.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(node)
    return node


@app.delete("/script-tree/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script_node(
    node_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db)
):
    node = db.query(ScriptNode).filter(ScriptNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.parent_id is None:
        raise HTTPException(status_code=400, detail="Root folder cannot be deleted")

    def delete_recursive(n: ScriptNode):
        children = db.query(ScriptNode).filter(ScriptNode.parent_id == n.id).all()
        for child in children:
            delete_recursive(child)
        db.delete(n)

    delete_recursive(node)
    db.commit()
    return None


# Routes - Comments on Requests
@app.get("/requests/{request_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    comments = db.query(Comment).filter(Comment.request_id == request_id).order_by(Comment.created_at.asc()).all()
    return comments


@app.post("/requests/{request_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    request_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    if current_user.role == "ARCHITECT" and request_obj.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    now_ms = int(time.time() * 1000)
    comment = Comment(
        request_id=request_id,
        user_id=current_user.id,
        author_name=current_user.name,
        content=payload.content,
        created_at=now_ms
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


# Routes - AI Analysis
@app.post("/requests/{request_id}/analyze")
async def analyze_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")
    
    request_obj = db.query(Request).filter(Request.id == request_id).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    system_prompt = f"""Analyze this Revit {request_obj.revit_version} automation request:

TITLE: {request_obj.title}
DESCRIPTION: {request_obj.description}
PRIORITY: {request_obj.priority}

Provide JSON with: complexityScore (1-10), suggestedNamespaces (array), implementationStrategy (string), pseudoCode (string)"""
    
    try:
        content_parts = [system_prompt]
        
        image_attachments = [att for att in request_obj.attachments if att.type.startswith("image/")]
        for attachment in image_attachments:
            try:
                content_parts.append({
                    "mime_type": attachment.type,
                    "data": attachment.data
                })
            except Exception as e:
                print(f"Warning: Could not process image: {e}")
        
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(content_parts)
        
        response_text = response.text.strip()
        
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        analysis_result = json.loads(response_text)
        
        request_obj.ai_analysis = json.dumps(analysis_result)
        request_obj.updated_at = int(time.time() * 1000)
        db.commit()
        
        return analysis_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


# Routes - Notifications
@app.post("/notifications/email")
async def send_email_notification(
    notification: EmailNotification,
    current_user: User = Depends(get_current_user)
):
    recipient = notification.to or DEFAULT_ADMIN_EMAIL
    
    if SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart()
            msg['From'] = SMTP_FROM
            msg['To'] = recipient
            msg['Subject'] = notification.subject
            msg.attach(MIMEText(notification.body, 'html'))
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            
            print(f"✉️  Email sent to {recipient}")
            return {"status": "sent", "to": recipient, "method": "smtp"}
        except Exception as e:
            print(f"❌ SMTP failed: {e}")
    
    print(f"\n{'='*80}\n📧 EMAIL: {notification.subject}\nTo: {recipient}\n{notification.body}\n{'='*80}\n")
    
    return {"status": "logged", "to": recipient, "method": "console"}


# Root
@app.get("/")
async def root():
    return {
        "message": "Revit Automation Hub API",
        "version": "3.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": int(time.time())}


if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting Revit Automation Hub Backend v3.0...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
