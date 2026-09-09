"""
Explainable AI candidate extraction and proposal API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.requests import AIProposeCandidatesRequest
from backend.app.schemas.responses import AIProposeCandidatesResponse

router = APIRouter(prefix="/ai/candidates", tags=["AI Candidate Proposer"])


@router.post("/propose", response_model=AIProposeCandidatesResponse, status_code=status.HTTP_200_OK)
def propose_ai_candidates(
    req: AIProposeCandidatesRequest,
    db: Session = Depends(get_db)
):
    """
    Executes explainable AI candidate extraction from building extraction / LiDAR evidence.
    Returns structured candidate hypotheses with feature vectors, explanations, and prototype confidence.
    """
    service = AICandidateService(db)
    try:
        return service.propose_candidates(req)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence file not found: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Candidate extraction error: {str(e)}"
        )
