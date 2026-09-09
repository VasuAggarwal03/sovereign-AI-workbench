from dataclasses import dataclass
import re


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str
    risk_level: str


# High-risk requests that should NEVER reach the model
HIGH_RISK_PATTERNS = [
    # Authentication / access bypass
    "bypass authentication",
    "bypass login",
    "bypass password",
    "bypass security",
    "disable security",
    "circumvent authentication",

    # Credential theft
    "steal passwords",
    "steal credentials",
    "get someone's password",
    "get user passwords",
    "extract passwords",
    "dump credentials",

    # Malware
    "deploy malware",
    "create malware",
    "write malware",
    "install malware",
    "ransomware",
    "deploy ransomware",

    # Destructive actions
    "delete all files",
    "destroy all files",
    "wipe the system",
    "erase the system",

    # Security evasion
    "evade antivirus",
    "bypass antivirus",
    "disable antivirus",
    "bypass security controls",
]


# Suspicious requests that deserve extra scrutiny
MEDIUM_RISK_PATTERNS = [
    "exploit vulnerability",
    "exploit a vulnerability",
    "penetrate a system",
    "break into a system",
    "attack a server",
    "steal data",
    "exfiltrate data",
]


def normalize_text(text: str) -> str:
    """
    Normalize user input so simple variations in spacing
    and punctuation don't easily evade the policy.
    """
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def evaluate_request(prompt: str) -> PolicyDecision:
    """
    Evaluate an incoming request before it reaches the AI model.
    """

    normalized_prompt = normalize_text(prompt)

    # ---------------------------------------------------------
    # 1. HIGH-RISK CHECK
    # ---------------------------------------------------------
    for pattern in HIGH_RISK_PATTERNS:
        if pattern in normalized_prompt:
            return PolicyDecision(
                allowed=False,
                reason=f"Blocked by security policy: {pattern}",
                risk_level="high",
            )

    # ---------------------------------------------------------
    # 2. MEDIUM-RISK CHECK
    # ---------------------------------------------------------
    for pattern in MEDIUM_RISK_PATTERNS:
        if pattern in normalized_prompt:
            return PolicyDecision(
                allowed=True,
                reason=f"Request contains a security-sensitive topic: {pattern}",
                risk_level="medium",
            )

    # ---------------------------------------------------------
    # 3. NORMAL REQUEST
    # ---------------------------------------------------------
    return PolicyDecision(
        allowed=True,
        reason="Request passed the initial security policy.",
        risk_level="low",
    )