"""
Run this once to create all tables
"""
from .database import engine, Base
from .document import Document  # noqa: F401
from .user import User          # noqa: F401


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")


if __name__ == "__main__":
    create_tables()