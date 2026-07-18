"""Gemini LLM access with graceful degradation.

If GOOGLE_API_KEY is unset or a call fails (rate limit, timeout, network),
callers receive None / their fallback value and the graph continues in
deterministic rule-based mode (state.degraded = True).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Callable, Optional

logger = logging.getLogger("agent-service.llm")

_llm = None
_llm_initialized = False

LLM_TIMEOUT_SECONDS = 8


def get_llm():
    """Returns a ChatGoogleGenerativeAI instance, or None when no key is configured."""
    global _llm, _llm_initialized
    if _llm_initialized:
        return _llm
    _llm_initialized = True

    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set — agents run in rule-based fallback mode")
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            google_api_key=api_key,
            temperature=0.2,
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=1,
        )
        logger.info("Gemini LLM initialised (%s)", os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
    except Exception as ex:
        logger.warning("Could not initialise Gemini LLM: %s", ex)
        _llm = None
    return _llm


def _extract_json(text: str) -> Optional[dict]:
    """Best-effort JSON extraction from an LLM reply (handles ```json fences)."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    if not candidate.startswith("{"):
        brace = candidate.find("{")
        if brace == -1:
            return None
        candidate = candidate[brace:]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def invoke_json(prompt: str, fallback: Callable[[], Optional[dict]] = lambda: None) -> Optional[dict]:
    """Invoke the LLM expecting a JSON object reply; fall back on any failure."""
    llm = get_llm()
    if llm is None:
        return fallback()
    try:
        reply = llm.invoke(prompt)
        parsed = _extract_json(reply.content if hasattr(reply, "content") else str(reply))
        if parsed is None:
            logger.warning("LLM reply was not parseable JSON — using fallback")
            return fallback()
        return parsed
    except Exception as ex:
        logger.warning("LLM invocation failed (%s) — using fallback", ex)
        return fallback()


def invoke_json_multimodal(prompt: str, image_data_url: str, fallback: Callable[[], Optional[dict]] = lambda: None) -> Optional[dict]:
    """Invoke Gemini with text + an inline image (data URL); JSON reply expected."""
    llm = get_llm()
    if llm is None:
        return fallback()
    try:
        from langchain_core.messages import HumanMessage

        message = HumanMessage(content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": image_data_url},
        ])
        reply = llm.invoke([message])
        parsed = _extract_json(reply.content if hasattr(reply, "content") else str(reply))
        if parsed is None:
            logger.warning("Multimodal LLM reply was not parseable JSON — using fallback")
            return fallback()
        return parsed
    except Exception as ex:
        logger.warning("Multimodal LLM invocation failed (%s) — using fallback", ex)
        return fallback()


def invoke_text(prompt: str) -> Optional[str]:
    """Invoke the LLM for free text; None on any failure."""
    llm = get_llm()
    if llm is None:
        return None
    try:
        reply = llm.invoke(prompt)
        content = reply.content if hasattr(reply, "content") else str(reply)
        return content.strip() or None
    except Exception as ex:
        logger.warning("LLM invocation failed (%s)", ex)
        return None


def llm_available() -> bool:
    return get_llm() is not None
