"""
event_store.py
--------------
Storage em memória dos eventos de segurança detectados pelo ZettaGuard.

Para MVP: lista em memória (sem persistência).
Para produção: substituir por Redis, PostgreSQL ou similar.

Cada evento contém:
  - id: UUID único
  - timestamp: ISO 8601
  - direction: "input" | "output"
  - category: categoria do ataque detectado
  - severity: CRITICAL | HIGH | MEDIUM | LOW
  - score: 0-100
  - decision: "Bloqueado" | "Em análise" | "Permitido"
  - prompt_snippet: primeiros 200 chars do prompt (truncado)
  - matched_patterns: lista de IDs de padrões que dispararam
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class SecurityEvent:
    id: str
    timestamp: str
    direction: str           # "input" | "output"
    category: str            # categoria primária do ataque
    severity: str            # CRITICAL | HIGH | MEDIUM | LOW
    score: int               # 0-100
    decision: str            # "Bloqueado" | "Em análise" | "Permitido"
    prompt_snippet: str      # primeiros 200 chars
    matched_patterns: List[str] = field(default_factory=list)
    ai_classification: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class EventStore:
    """Storage em memória thread-safe para eventos de segurança."""

    MAX_EVENTS = 1000  # limita memória

    def __init__(self):
        self._events: List[SecurityEvent] = []
        self._counters = {
            "total": 0,
            "bloqueados": 0,
            "em_analise": 0,
            "permitidos": 0,
            "by_category": {},
            "by_severity": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        }

    def add(
        self,
        direction: str,
        category: str,
        severity: str,
        score: int,
        decision: str,
        prompt: str,
        matched_patterns: List[str],
        ai_classification: Optional[Dict[str, Any]] = None,
    ) -> SecurityEvent:
        """Registra um novo evento de segurança."""
        event = SecurityEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            direction=direction,
            category=category,
            severity=severity,
            score=score,
            decision=decision,
            prompt_snippet=prompt[:200] + ("..." if len(prompt) > 200 else ""),
            matched_patterns=matched_patterns,
            ai_classification=ai_classification,
        )

        self._events.insert(0, event)  # mais recentes primeiro

        # limpa eventos antigos se exceder o limite
        if len(self._events) > self.MAX_EVENTS:
            self._events = self._events[: self.MAX_EVENTS]

        # atualiza contadores
        self._counters["total"] += 1
        if decision == "Bloqueado":
            self._counters["bloqueados"] += 1
        elif decision == "Em análise":
            self._counters["em_analise"] += 1
        else:
            self._counters["permitidos"] += 1

        self._counters["by_category"][category] = (
            self._counters["by_category"].get(category, 0) + 1
        )
        if severity in self._counters["by_severity"]:
            self._counters["by_severity"][severity] += 1

        return event

    def get_events(
        self,
        limit: int = 50,
        category: Optional[str] = None,
        decision: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retorna eventos filtrados."""
        events = self._events

        if category:
            events = [e for e in events if e.category == category]
        if decision:
            events = [e for e in events if e.decision == decision]
        if severity:
            events = [e for e in events if e.severity == severity]

        return [e.to_dict() for e in events[:limit]]

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas gerais."""
        total = self._counters["total"]
        bloqueados = self._counters["bloqueados"]
        taxa = round((bloqueados / total * 100), 1) if total > 0 else 0.0

        return {
            "total": total,
            "bloqueados": bloqueados,
            "em_analise": self._counters["em_analise"],
            "permitidos": self._counters["permitidos"],
            "taxa_bloqueio": taxa,
            "by_category": self._counters["by_category"],
            "by_severity": self._counters["by_severity"],
        }

    def clear(self):
        """Limpa todos os eventos (útil para testes)."""
        self._events.clear()
        self._counters = {
            "total": 0,
            "bloqueados": 0,
            "em_analise": 0,
            "permitidos": 0,
            "by_category": {},
            "by_severity": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        }


# Instância global compartilhada pela aplicação
event_store = EventStore()
