"""
Authentication routes: register, login, profile for clients and accountants
"""
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header
from sqlalchemy.orm import Session
from fastapi import Depends
from pydantic import BaseModel

from ..models.database import get_db
from ..models.user import User
from ..services.auth_service import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

BUSINESS_SECTORS = [
    "Food & Beverage", "Retail & Trading", "Manufacturing",
    "Professional Services", "IT & Technology", "Construction",
    "Healthcare", "Education", "Logistics & Transport", "Others",
]

EXPERTISE_AREAS = [
    "Food & Beverage", "Retail & Trading", "Manufacturing",
    "Professional Services", "IT & Technology", "Construction",
    "Healthcare", "Education", "Logistics & Transport", "General / SME",
]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ClientRegisterRequest(BaseModel):
    email: str
    password: str
    company_name: str
    tin_number: str
    business_sector: str
    phone_number: Optional[str] = None


class AccountantRegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    ic_number: str
    expertise_areas: List[str]
    phone_number: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    tin_number: Optional[str] = None
    business_sector: Optional[str] = None
    phone_number: Optional[str] = None
    name: Optional[str] = None
    ic_number: Optional[str] = None
    expertise_areas: Optional[List[str]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    areas: List[str] = []
    if user.expertise_areas:
        try:
            areas = json.loads(user.expertise_areas)
        except Exception:
            areas = []
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "company_name": user.company_name,
        "tin_number": user.tin_number,
        "business_sector": user.business_sector,
        "phone_number": user.phone_number,
        "name": user.name,
        "ic_number": user.ic_number,
        "expertise_areas": areas,
    }


def _get_auth_user(authorization: Optional[str], db: Session) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register/client")
def register_client(req: ClientRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        role="client",
        company_name=req.company_name,
        tin_number=req.tin_number,
        business_sector=req.business_sector,
        phone_number=req.phone_number,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user.id, user.role), "user": _user_to_dict(user)}


@router.post("/register/accountant")
def register_accountant(req: AccountantRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        role="accountant",
        name=req.name,
        ic_number=req.ic_number,
        expertise_areas=json.dumps(req.expertise_areas),
        phone_number=req.phone_number,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user.id, user.role), "user": _user_to_dict(user)}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_access_token(user.id, user.role), "user": _user_to_dict(user)}


@router.get("/me")
def get_me(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user = _get_auth_user(authorization, db)
    return _user_to_dict(user)


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = _get_auth_user(authorization, db)
    if req.phone_number is not None:
        user.phone_number = req.phone_number
    if user.role == "client":
        if req.company_name is not None:
            user.company_name = req.company_name
        if req.tin_number is not None:
            user.tin_number = req.tin_number
        if req.business_sector is not None:
            user.business_sector = req.business_sector
    else:
        if req.name is not None:
            user.name = req.name
        if req.ic_number is not None:
            user.ic_number = req.ic_number
        if req.expertise_areas is not None:
            user.expertise_areas = json.dumps(req.expertise_areas)
    db.commit()
    db.refresh(user)
    return _user_to_dict(user)


@router.get("/sectors")
def get_sectors():
    return {"business_sectors": BUSINESS_SECTORS, "expertise_areas": EXPERTISE_AREAS}


@router.get("/accountants")
def list_accountants(sector: Optional[str] = None, db: Session = Depends(get_db)):
    accountants = db.query(User).filter(User.role == "accountant").all()
    result = []
    for a in accountants:
        areas: List[str] = []
        if a.expertise_areas:
            try:
                areas = json.loads(a.expertise_areas)
            except Exception:
                areas = []
        if sector and sector not in areas and "General / SME" not in areas:
            continue
        result.append({
            "id": a.id,
            "name": a.name or a.email.split("@")[0],
            "email": a.email,
            "expertise_areas": areas,
        })
    return {"accountants": result}
