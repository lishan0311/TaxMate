"""
User model for clients (business owners) and accountants
"""
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
import uuid
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'client' or 'accountant'

    # Client/Business Owner fields
    company_name = Column(String, nullable=True)
    tin_number = Column(String, nullable=True)       # Company TIN for SST form
    business_sector = Column(String, nullable=True)  # For matching accountants
    bound_accountant_id = Column(String, nullable=True) # Linked accountant ID

    # Accountant fields
    name = Column(String, nullable=True)
    ic_number = Column(String, nullable=True)
    expertise_areas = Column(Text, nullable=True)    # JSON array of strings
    phone_number = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
