# Product Vision

Status: Draft  
Sprint: Sprint 2 – Engineering Foundation  
Owner: Human Architect + Technical Lead  
Decision Impact: Very High  
Approval: EP-001 approved by Human Architect

## Purpose

This document defines why TapTim.e exists.

It is a high-impact product document. Future product, architecture and implementation decisions should be evaluated against this vision.

## 1. Mission

TapTim.e entwickelt Lösungen, mit denen Unternehmen Arbeitszeit einfach, zuverlässig und ohne Unterbrechung des Arbeitsflusses erfassen können.

Arbeitszeiterfassung soll kein zusätzlicher Arbeitsprozess sein.

Sie soll sich natürlich in den Arbeitsalltag integrieren und Mitarbeiter dabei unterstützen, sich auf ihre eigentliche Arbeit zu konzentrieren.

Jede Produktentscheidung soll diesem Ziel dienen.

## 2. Vision

TapTim.e wird die führende Plattform für intelligente und vertrauenswürdige Arbeitszeiterfassung in kleinen und mittelständischen Unternehmen.

Unsere Software unterstützt Unternehmen dabei, Arbeitszeit so einfach zu erfassen, dass sie den Arbeitsalltag nicht unterbricht.

Dabei steht nicht die Erfassung selbst im Mittelpunkt, sondern die Menschen und Unternehmen, die ihre Arbeit effizient, nachvollziehbar und mit möglichst geringem Verwaltungsaufwand erledigen möchten.

TapTim.e entwickelt sich langfristig zu einer Plattform für Arbeitsereignisse, deren erste Kernanwendung die Zeiterfassung ist.

## 3. The Problem

Unternehmen investieren täglich Zeit in die Erfassung von Arbeitszeiten.

In vielen Fällen ist dieser Prozess jedoch unnötig komplex, fehleranfällig und unterbricht den eigentlichen Arbeitsablauf.

Mitarbeiter müssen Anwendungen öffnen, Kunden oder Projekte suchen, Zeiten manuell starten und stoppen oder Arbeitszeiten nachträglich erfassen.

Dadurch entstehen:

- unnötiger Verwaltungsaufwand,
- fehlerhafte oder unvollständige Zeiterfassungen,
- Akzeptanzprobleme bei Mitarbeitern,
- zusätzlicher Prüf- und Korrekturaufwand für Unternehmen.

Das eigentliche Problem ist dabei nicht die Zeiterfassung selbst.

Das Problem ist, dass sich Mitarbeiter mit der Zeiterfassung beschäftigen müssen, anstatt sich auf ihre eigentliche Arbeit zu konzentrieren.

Je häufiger die Software den Arbeitsfluss unterbricht, desto größer werden Fehler, Frustration und administrativer Aufwand.

TapTim.e versteht Zeiterfassung deshalb nicht als Verwaltungsaufgabe, sondern als einen möglichst unsichtbaren Bestandteil des Arbeitsalltags.

## 4. Unsere Lösung

TapTim.e löst das Problem nicht durch mehr Funktionen, sondern durch weniger notwendige Entscheidungen.

Die Grundlage des Produkts ist eine einfache Philosophie:

> **One Tap. One Decision.**

Jede Benutzerinteraktion erzeugt genau ein fachliches Ereignis.

Die Bedeutung dieses Ereignisses wird nicht vom Benutzer bestimmt, sondern von der Business Engine.

Dadurch reduziert TapTim.e die Anzahl manueller Entscheidungen während der täglichen Arbeit auf ein Minimum.

Mitarbeiter müssen sich nicht überlegen, welche Funktion sie auswählen oder welchen Status sie setzen müssen.

Sie konzentrieren sich auf ihre eigentliche Arbeit.

TapTim.e interpretiert die Interaktion, wendet die Geschäftsregeln an und erzeugt nachvollziehbare, überprüfbare und vertrauenswürdige Arbeitszeitdaten.

Diese Architektur ermöglicht es, verschiedene Auslöser wie NFC, QR-Codes, manuelle Eingaben oder zukünftige Integrationen zu unterstützen, ohne die grundlegende Produktphilosophie zu verändern.

Die Technologie dient dabei niemals dem Selbstzweck.

Sie dient ausschließlich dazu, den Arbeitsfluss der Benutzer so wenig wie möglich zu unterbrechen.

## 5. Product Philosophy

The development of TapTim.e follows one simple philosophy:

> **One Tap. One Decision.**

Every user interaction should create exactly one business event.

The Business Engine interprets that event—not the user.

This philosophy leads to the following principles:

- The user's workflow always comes first.
- Software should reduce decisions, not create more.
- Complexity belongs in the system, not with the user.
- Every system decision must be transparent and auditable.
- Technology exists only to improve the workflow.
- Every new feature must strengthen this philosophy.

TapTim.e is not measured by the number of features it offers.

Its success is measured by how little attention time tracking requires during real work.

The best time tracking is the one users do not have to think about.

## 6. Langfristige Vision

TapTim.e beginnt als Plattform für intelligente Arbeitszeiterfassung.

Langfristig soll daraus ein System entstehen, das Arbeitsereignisse zuverlässig, nachvollziehbar und möglichst automatisch dokumentiert.

Die Zeiterfassung bildet dabei den ersten und wichtigsten Anwendungsfall.

Die zugrunde liegende Architektur wird jedoch bewusst so entwickelt, dass zukünftige Erweiterungen möglich sind, ohne die Produktphilosophie zu verändern.

Unabhängig davon, ob ein Arbeitsereignis durch einen NFC-Scan, einen QR-Code, eine mobile Anwendung, eine Webanwendung oder zukünftige Technologien ausgelöst wird, gelten immer dieselben Grundprinzipien:

- Ein Ereignis wird erfasst.
- Die Business Engine interpretiert das Ereignis.
- Das System trifft nachvollziehbare Entscheidungen.
- Der Benutzer bleibt im Mittelpunkt seines Arbeitsablaufs.

TapTim.e entwickelt sich nicht durch immer mehr Funktionen.

TapTim.e entwickelt sich durch immer intelligentere Unterstützung der täglichen Arbeit.

Unser langfristiges Ziel ist es, dass Arbeitszeiterfassung nicht mehr als eigenständige Aufgabe wahrgenommen wird, sondern als selbstverständlicher Bestandteil des Arbeitsalltags.

## Governance

This document is owned by the Human Architect and Technical Lead.

Changes to the Product Vision require Human Architect review and explicit approval.
