"""
TaxMate Workflow Orchestrator — the central brain that coordinates
the ENTIRE monthly SST compliance workflow.

Without GLM, TaxMate cannot decide what to do next.
This is the "stateful and adaptive workflow engine" the competition asks for.
"""
import json
import os
from datetime import datetime
from anthropic import Anthropic
import httpx

from .tax_agent import (
    analyze_monthly_batch,
    generate_sst02_field_mapping,
    generate_review_brief,
    generate_personalized_email,
    _generate_text,
)

load_dotenv = None
try:
    from dotenv import load_dotenv as _ld
    _ld()
except Exception:
    pass

client = Anthropic(
    api_key=os.getenv("Z.AI_API_KEY"),
    base_url="https://api.ilmu.ai/anthropic",
    timeout=httpx.Timeout(180.0, connect=30.0),
    max_retries=2,
)
MODEL = "ilmu-glm-5.1"


ORCHESTRATOR_PROMPT = """You are TaxMate's Workflow Orchestrator — the central brain
that manages the ENTIRE monthly SST compliance workflow for a Malaysian SME.

You receive the current workflow STATE and must decide WHAT TO DO NEXT.
Call ONE tool per turn. After seeing the result, decide the next action.

# WORKFLOW STAGES:
1. INTAKE — receipts uploaded, need processing
2. ANALYSIS — all processed, need batch analysis
3. REVIEW_PREP — analysis done, prepare accountant briefing
4. AWAITING_REVIEW — sent to accountant, waiting
5. FILING — accountant approved, generate SST-02
6. NOTIFICATION — SST-02 ready, notify owner
7. COMPLETE — all done

# ADAPTIVE RULES:
- If > 30% documents have risk flags → DO NOT proceed to filing, request review first
- If filing deadline < 7 days → add URGENT flag to all communications
- If all documents confidence > 0.9 → can skip detailed review, fast-track to filing
- If duplicate warnings found → MUST flag before filing
- If total tax payable > RM 10,000 → add extra verification step

# IMPORTANT:
- Do NOT use markdown formatting (no *, **, ##, |, backticks). Use plain text only.
- Your FINAL response must be SHORT: max 2-3 sentences describing the current stage and what the user should do next.
- Be conversational and friendly, like a helpful assistant. Not robotic.
- Example good response: "Your receipts are analyzed and 1 needs review. Head to the review page to approve it before filing."
- Example bad response: Long paragraphs with numbered lists and technical details.
"""

ORCHESTRATOR_TOOLS = [
    {
        "name": "check_workflow_status",
        "description": "Check current state: how many docs processed/pending/approved, any blockers",
        "input_schema": {
            "type": "object",
            "properties": {
                "detail_level": {
                    "type": "string",
                    "enum": ["summary", "detailed"],
                    "description": "How much detail to return",
                }
            },
            "required": ["detail_level"],
        },
    },
    {
        "name": "trigger_batch_analysis",
        "description": "Run cross-document analysis on all processed receipts. Finds duplicates, anomalies, compliance risks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "focus_areas": {
                    "type": "string",
                    "description": "What to focus on: duplicates, anomalies, compliance, all",
                }
            },
            "required": ["focus_areas"],
        },
    },
    {
        "name": "prepare_accountant_brief",
        "description": "Generate AI review briefing for the accountant with risk assessment",
        "input_schema": {
            "type": "object",
            "properties": {
                "urgency": {
                    "type": "string",
                    "enum": ["normal", "urgent"],
                    "description": "Whether to mark the brief as urgent",
                }
            },
            "required": ["urgency"],
        },
    },
    {
        "name": "generate_filing",
        "description": "Generate SST-02 field mapping from approved documents",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "integer", "description": "Filing month"},
                "year": {"type": "integer", "description": "Filing year"},
            },
            "required": ["month", "year"],
        },
    },
    {
        "name": "send_notification",
        "description": "Prepare a personalized notification for owner or accountant",
        "input_schema": {
            "type": "object",
            "properties": {
                "recipient": {
                    "type": "string",
                    "enum": ["owner", "accountant"],
                },
                "notification_type": {
                    "type": "string",
                    "enum": [
                        "review_ready",
                        "filing_complete",
                        "action_needed",
                        "deadline_warning",
                    ],
                },
            },
            "required": ["recipient", "notification_type"],
        },
    },
    {
        "name": "assess_risk_level",
        "description": "Evaluate overall compliance risk and decide if workflow can proceed to filing",
        "input_schema": {
            "type": "object",
            "properties": {
                "risk_threshold": {
                    "type": "string",
                    "enum": ["strict", "normal", "relaxed"],
                }
            },
            "required": ["risk_threshold"],
        },
    },
]


def _filing_deadline_info() -> dict:
    now = datetime.now()
    m = now.month
    if m <= 2:
        deadline = datetime(now.year, 3, 31)
    elif m <= 4:
        deadline = datetime(now.year, 5, 31)
    elif m <= 6:
        deadline = datetime(now.year, 7, 31)
    elif m <= 8:
        deadline = datetime(now.year, 9, 30)
    elif m <= 10:
        deadline = datetime(now.year, 11, 30)
    else:
        deadline = datetime(now.year + 1, 1, 31)
    days_left = (deadline - now).days
    return {
        "deadline": deadline.strftime("%Y-%m-%d"),
        "days_to_deadline": days_left,
        "urgency": "CRITICAL" if days_left < 3 else "URGENT" if days_left < 7 else "NORMAL",
    }


def execute_orchestrator_tool(name: str, args: dict, workflow_state: dict) -> str:
    docs = workflow_state.get("documents", [])

    if name == "check_workflow_status":
        processed = sum(1 for d in docs if d.get("status") == "processed")
        pending_review = sum(1 for d in docs if d.get("status") == "pending_review")
        approved = sum(1 for d in docs if d.get("status") == "approved")
        signed = sum(1 for d in docs if d.get("status") == "signed")
        rejected = sum(1 for d in docs if d.get("status") == "rejected")
        errors = sum(1 for d in docs if d.get("status") == "error")
        high_risk = sum(1 for d in docs if (d.get("risk_count") or 0) > 0)
        avg_conf = sum(d.get("confidence") or 0 for d in docs) / max(len(docs), 1)
        deadline_info = _filing_deadline_info()

        done = approved + signed
        risk_pct = round(high_risk / max(len(docs), 1) * 100, 1)

        if len(docs) == 0:
            stage = "INTAKE"
            rec = "Upload receipts to begin processing"
        elif processed > 0 and done == 0:
            stage = "ANALYSIS"
            rec = "Run batch analysis before proceeding to review"
        elif pending_review > 0 and done < len(docs):
            stage = "REVIEW_PREP"
            rec = "Some documents need accountant review"
        elif done == len(docs) and signed == 0:
            stage = "FILING"
            rec = "All approved — ready to generate SST-02"
        elif signed > 0 and signed < len(docs):
            stage = "FILING"
            rec = "Some signed, continue with remaining approvals"
        elif signed == len(docs):
            stage = "COMPLETE"
            rec = "All documents signed and filed"
        else:
            stage = "MIXED"
            rec = "Review rejected/error documents before proceeding"

        status = {
            "total_documents": len(docs),
            "processed": processed,
            "pending_review": pending_review,
            "approved": approved,
            "signed": signed,
            "rejected": rejected,
            "errors": errors,
            "high_risk_count": high_risk,
            "risk_percentage": risk_pct,
            "avg_confidence": round(avg_conf, 2),
            "stage": stage,
            "recommendation": rec,
            **deadline_info,
        }
        return json.dumps(status, indent=2)

    elif name == "trigger_batch_analysis":
        batch_docs = [{
            "supplier_name": d.get("supplier_name"),
            "total_amount": d.get("total_amount"),
            "tax_treatment": d.get("tax_treatment"),
            "risk_count": d.get("risk_count"),
            "agent_result": d.get("agent_result", {}),
        } for d in docs if d.get("status") in ("processed", "pending_review", "approved", "signed")]

        if not batch_docs:
            return json.dumps({"error": "No documents available for batch analysis"})

        result = analyze_monthly_batch(batch_docs)
        return json.dumps(result, indent=2, default=str)

    elif name == "prepare_accountant_brief":
        brief_docs = [{
            "supplier_name": d.get("supplier_name"),
            "total_amount": d.get("total_amount"),
            "tax_treatment": d.get("tax_treatment"),
            "risk_count": d.get("risk_count"),
            "confidence": d.get("confidence"),
            "agent_result": d.get("agent_result", {}),
        } for d in docs]

        brief = generate_review_brief(brief_docs)
        urgency = args.get("urgency", "normal")
        if urgency == "urgent":
            deadline_info = _filing_deadline_info()
            brief = (
                f"URGENT — Filing deadline in {deadline_info['days_to_deadline']} days "
                f"({deadline_info['deadline']}).\n\n{brief}"
            )
        return brief

    elif name == "generate_filing":
        approved_docs = [d for d in docs if d.get("status") in ("approved", "signed")]
        if not approved_docs:
            return json.dumps({"error": "No approved documents to file"})

        summaries = [{
            "supplier_name": d.get("supplier_name"),
            "total_amount": d.get("total_amount"),
            "tax_treatment": d.get("tax_treatment"),
            "sst_amount": (d.get("agent_result") or {}).get("amount", {}).get("sst_amount"),
        } for d in approved_docs]

        mapping = generate_sst02_field_mapping(summaries)
        return json.dumps(mapping, indent=2, default=str)

    elif name == "send_notification":
        recipient = args.get("recipient", "owner")
        notif_type = args.get("notification_type", "review_ready")

        summary = {
            "total_documents": len(docs),
            "approved": sum(1 for d in docs if d.get("status") in ("approved", "signed")),
            "net_payable": sum(
                (d.get("agent_result") or {}).get("amount", {}).get("sst_amount") or 0
                for d in docs if d.get("status") in ("approved", "signed")
            ),
        }

        if notif_type == "filing_complete":
            content = generate_personalized_email(summary, datetime.now().month)
            return f"Email prepared for {recipient}:\n\n{content}"
        elif notif_type == "deadline_warning":
            deadline_info = _filing_deadline_info()
            return (
                f"DEADLINE WARNING for {recipient}: SST-02 due in "
                f"{deadline_info['days_to_deadline']} days ({deadline_info['deadline']}). "
                f"{summary['total_documents']} documents, {summary['approved']} approved."
            )
        elif notif_type == "action_needed":
            pending = sum(1 for d in docs if d.get("status") == "pending_review")
            return (
                f"ACTION NEEDED for {recipient}: {pending} documents require review. "
                f"{summary['total_documents']} total, {summary['approved']} approved."
            )
        else:
            return (
                f"Review ready notification for {recipient}: "
                f"{summary['total_documents']} documents processed and ready for review."
            )

    elif name == "assess_risk_level":
        high_risk = sum(1 for d in docs if (d.get("risk_count") or 0) > 0)
        risk_pct = high_risk / max(len(docs), 1) * 100
        avg_conf = sum(d.get("confidence") or 0 for d in docs) / max(len(docs), 1)
        threshold = args.get("risk_threshold", "normal")

        if threshold == "strict":
            can_proceed = risk_pct < 10 and avg_conf > 0.85
        elif threshold == "relaxed":
            can_proceed = risk_pct < 50 and avg_conf > 0.5
        else:
            can_proceed = risk_pct < 30 and avg_conf > 0.7

        return json.dumps({
            "risk_percentage": round(risk_pct, 1),
            "avg_confidence": round(avg_conf, 2),
            "high_risk_documents": high_risk,
            "threshold_applied": threshold,
            "can_proceed_to_filing": can_proceed,
            "recommendation": (
                "Safe to proceed to filing"
                if can_proceed
                else "Review required before filing — too many risk flags or low confidence"
            ),
        })

    return f"Unknown orchestrator tool: {name}"


def run_orchestrator(workflow_state: dict, user_intent: str = "continue") -> dict:
    docs = workflow_state.get("documents", [])
    state_summary = {
        "total_documents": len(docs),
        "by_status": {},
        "user_intent": user_intent,
        "current_time": datetime.now().isoformat(),
    }
    for doc in docs:
        status = doc.get("status", "unknown")
        state_summary["by_status"][status] = state_summary["by_status"].get(status, 0) + 1

    # Pre-compute structured data from workflow state (no AI needed for this)
    structured = _compute_workflow_status(docs)

    messages = [
        {
            "role": "user",
            "content": f"""{ORCHESTRATOR_PROMPT}

Current workflow state:
{json.dumps(state_summary, indent=2)}

User wants to: {user_intent}

What should happen next? Call ONE tool to take the next step.""",
        }
    ]

    thinking_steps = []

    for step in range(5):
        try:
            response = client.messages.create(
                model=MODEL,
                messages=messages,
                tools=ORCHESTRATOR_TOOLS,
                temperature=0.1,
                max_tokens=4096,
            )

            if response.stop_reason == "tool_use":
                tool_use_block = None
                for block in response.content:
                    if block.type == "tool_use":
                        tool_use_block = block
                        break

                if tool_use_block:
                    func_name = tool_use_block.name
                    func_args = tool_use_block.input

                    thinking_steps.append({
                        "step": step + 1,
                        "type": "orchestrator_decision",
                        "action": f"Orchestrator calls: {func_name}",
                        "input": func_args,
                    })

                    tool_result = execute_orchestrator_tool(
                        func_name, func_args, workflow_state
                    )

                    thinking_steps.append({
                        "step": step + 1,
                        "type": "orchestrator_result",
                        "action": "Tool completed",
                        "output": tool_result[:500],
                    })

                    # Extract structured data from check_workflow_status result
                    if func_name == "check_workflow_status":
                        try:
                            parsed = json.loads(tool_result)
                            structured.update(parsed)
                        except Exception:
                            pass

                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": tool_use_block.id,
                            "content": tool_result,
                        }],
                    })
                    continue

            # Final response
            final_text = ""
            for block in response.content:
                if block.type == "text":
                    final_text += block.text

            thinking_steps.append({
                "step": step + 1,
                "type": "orchestrator_conclusion",
                "action": "Orchestrator provides recommendation",
            })

            return {
                "recommendation": final_text,
                "thinking_steps": thinking_steps,
                "actions_taken": [
                    s["action"] for s in thinking_steps if "calls" in s.get("action", "")
                ],
                "structured": structured,
            }

        except Exception as e:
            thinking_steps.append({
                "step": step + 1,
                "type": "error",
                "action": str(e),
            })
            continue

    # Fallback: if orchestrator failed, return a rule-based recommendation
    result = _rule_based_recommendation(workflow_state, thinking_steps)
    result["structured"] = structured
    return result


def _compute_workflow_status(docs: list) -> dict:
    """Compute structured workflow status without AI — used for UI rendering."""
    processed = sum(1 for d in docs if d.get("status") == "processed")
    pending_review = sum(1 for d in docs if d.get("status") == "pending_review")
    approved = sum(1 for d in docs if d.get("status") == "approved")
    signed = sum(1 for d in docs if d.get("status") == "signed")
    rejected = sum(1 for d in docs if d.get("status") == "rejected")
    total = len(docs)
    done = approved + signed
    high_risk = sum(1 for d in docs if (d.get("risk_count") or 0) > 0)
    deadline_info = _filing_deadline_info()

    if total == 0:
        stage = "INTAKE"
    elif processed > 0 and done == 0:
        stage = "ANALYSIS"
    elif pending_review > 0 and done < total:
        stage = "REVIEW_PREP"
    elif done == total and signed == 0:
        stage = "FILING"
    elif signed == total:
        stage = "COMPLETE"
    else:
        stage = "MIXED"

    return {
        "stage": stage,
        "total_documents": total,
        "pending_review": pending_review,
        "approved": approved + signed,
        "high_risk_count": high_risk,
        "filing_deadline": deadline_info["deadline"],
        "days_to_deadline": deadline_info["days_to_deadline"],
        "deadline_urgency": deadline_info["urgency"],
    }


def _rule_based_recommendation(workflow_state: dict, thinking_steps: list) -> dict:
    """Fallback when AI orchestrator fails — uses simple rules."""
    docs = workflow_state.get("documents", [])
    processed = sum(1 for d in docs if d.get("status") == "processed")
    pending = sum(1 for d in docs if d.get("status") == "pending_review")
    approved = sum(1 for d in docs if d.get("status") in ("approved", "signed"))
    rejected = sum(1 for d in docs if d.get("status") == "rejected")
    total = len(docs)

    if total == 0:
        rec = "Upload receipts to begin processing."
    elif pending > 0:
        rec = f"{pending} documents need accountant review. Submit them for review first."
    elif approved == total:
        rec = "All documents approved. Ready to sign and file SST-02."
    elif rejected > 0:
        rec = f"{rejected} documents were rejected. Review them before proceeding."
    elif processed > 0:
        rec = "Documents are processed. Submit them for accountant review."
    else:
        rec = "Continue with your current workflow."

    return {
        "recommendation": rec,
        "thinking_steps": thinking_steps,
        "actions_taken": [],
    }
