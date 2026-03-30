"""
User Schema Models
"""
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    """Base User Schema"""
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    """User Creation Schema"""
    password: str

class UserLogin(BaseModel):
    """User Login Schema"""
    email: EmailStr
    password: str

class UserResponse(UserBase):
    """User Response Schema"""
    id: int
    created_at: str
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    """Token Response Schema"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
