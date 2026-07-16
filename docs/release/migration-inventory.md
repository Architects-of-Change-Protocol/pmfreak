# Migration Inventory — Perilla 13 (updated by Perilla 13B)

Generated from `supabase/migrations/` at commit range starting `8422302` (Perilla 12 merge). Order = lexicographic filename order = the order `supabase db push` / a plain `psql -f` loop applies them, verified by `npm run check:fresh-db-migrations` (ordering + duplicate-timestamp checks) and by an actual fresh apply (see `fresh-database-migration-proof.md`).

**Total migration files discovered: 144** (142 pre-existing + 2 corrective migrations added by Perilla 13: `20260823000000_fix_capability_verification_evidence_rls_gap.sql`, `20260823000001_fix_workspace_memberships_rls_recursion.sql`) at Perilla 13 close. **Perilla 13B added 2 more corrective migrations (rows 145–146 below), bringing the total to 146.** **Founder Circle Sprint 01 (2026-07-16) refreshed this inventory: rows 147–148 record the two Pilot Gate Sprint 01 migrations that had landed without inventory rows, and row 149 adds the Founder Circle domain migration — current total: 149.** Note: rows 147–148 were validated by the Pilot Gate fresh-apply proof (147/147); **row 149 has NOT been through a fresh-apply run in any environment yet** (static checks + migration test suites only — hosted execution remains the RR-MIGRATE gate) — see [`hosted-grants-report.md`](./hosted-grants-report.md) for what they fix (a static SECURITY DEFINER hardening review found and corrected 2 gaps: one missing `search_path`, and 7 functions across those 2 migrations missing an explicit PUBLIC execute revocation).

No other SQL bootstrap/seed/RPC/policy files exist outside `supabase/migrations/` — `find . -iname '*.sql' -not -path './node_modules/*'` returns only this directory's contents (verified during this audit).

Idempotent = the file uses `if not exists` / `if exists` / `or replace` for every DDL statement that creates or drops a named object (best-effort static scan; see remediation log for files where this was not actually true until fixed by this PR). Destructive = contains `drop table`, `truncate`, or an unconditional `delete from` with no `where` clause; none were found.

| Order | File | Timestamp | Purpose | Objects Created/Changed (truncated) | Idempotent | Destructive |
| ----: | ---- | --------- | ------- | ------------------------------------ | ---------- | ----------- |
| 1 | `20260428120000_p0_state_tables.sql` | 20260428120000 | p0 state tables | company_subscriptions, company_usage, project_memories | yes | no |
| 2 | `20260430113000_message_analyses.sql` | 20260430113000 | message analyses | message_analyses | yes | no |
| 3 | `20260430150000_project_suggestions.sql` | 20260430150000 | project suggestions | project_suggestions | yes | no |
| 4 | `20260430170000_onboarding_analyses.sql` | 20260430170000 | onboarding analyses | onboarding_analyses | yes | no |
| 5 | `20260504100000_projects_system.sql` | 20260504100000 | projects system | projects | yes | no |
| 6 | `20260505110000_subscription_plans_pmo.sql` | 20260505110000 | subscription plans pmo | (alters existing objects) | yes | no |
| 7 | `20260509120000_billing_webhook_events.sql` | 20260509120000 | billing webhook events | billing_webhook_events | yes | no |
| 8 | `20260509143000_workspace_team_invitations.sql` | 20260509143000 | workspace team invitations | workspace_invitations, workspace_audit_events | yes | no |
| 9 | `20260510120000_operational_memory_domains.sql` | 20260510120000 | operational memory domains | operational_memory_records | yes | no |
| 10 | `20260511110000_governance_audit_events.sql` | 20260511110000 | governance audit events | governance_audit_events | yes | no |
| 11 | `20260512120000_deterministic_verification_phase_6_4.sql` | 20260512120000 | deterministic verification phase 6 4 | capability_verification_snapshots, capability_verification_receipts, capability_ | yes | no |
| 12 | `20260512130000_operational_memory_v1.sql` | 20260512130000 | operational memory v1 | operational_memory_entries | yes | no |
| 13 | `20260512160000_workspace_authorization_rewrite.sql` | 20260512160000 | workspace authorization rewrite | workspaces, workspace_memberships | yes | no |
| 14 | `20260512183000_enterprise_auth_integrity.sql` | 20260512183000 | enterprise auth integrity | (alters existing objects) | yes | no |
| 15 | `20260512194000_phase4_enterprise_authorization.sql` | 20260512194000 | phase4 enterprise authorization | ai_agent_permissions | yes | no |
| 16 | `20260512195500_security_events.sql` | 20260512195500 | security events | security_events | yes | no |
| 17 | `20260512198000_early_access_trials.sql` | 20260512198000 | early access trials | early_access_invites, trial_licenses, workspace_activations, early_access_events | yes | no |
| 18 | `20260512210000_governance_approval_runtime.sql` | 20260512210000 | governance approval runtime | governance_approval_requests | yes | no |
| 19 | `20260512223000_governed_execution_grants.sql` | 20260512223000 | governed execution grants | governance_execution_grants | yes | no |
| 20 | `20260512233000_governance_delegations.sql` | 20260512233000 | governance delegations | governance_delegations | yes | no |
| 21 | `20260512234500_capability_claim_metadata.sql` | 20260512234500 | capability claim metadata | (alters existing objects) | yes | no |
| 22 | `20260512235900_first_user_telemetry.sql` | 20260512235900 | first user telemetry | first_user_telemetry_events | yes | no |
| 23 | `20260513010000_trust_domains_federated_verification.sql` | 20260513010000 | trust domains federated verification | capability_trust_domains, capability_signing_keys, capability_verifier_policies | yes | no |
| 24 | `20260513030000_external_verifier_handshakes.sql` | 20260513030000 | external verifier handshakes | capability_verifier_handshakes | yes | no |
| 25 | `20260513043000_distributed_trust_coordination.sql` | 20260513043000 | distributed trust coordination | capability_trust_events, capability_revocation_registry, capability_trust_graph_ | yes | no |
| 26 | `20260513100000_hardened_trust_interop_phase_6_3.sql` | 20260513100000 | hardened trust interop phase 6 3 | capability_trust_anchors, verifier_trust_policies, capability_trust_event_quaran | yes | no |
| 27 | `20260514120000_capability_request_flow.sql` | 20260514120000 | capability request flow | capability_requests, capability_grants, capability_audit_events | yes | no |
| 28 | `20260514143000_rls_tenant_hardening.sql` | 20260514143000 | rls tenant hardening | (alters existing objects) | yes | no |
| 29 | `20260514170000_policy_evaluation_engine_v1.sql` | 20260514170000 | policy evaluation engine v1 | capability_policies | yes | no |
| 30 | `20260514190000_delegation_chain_v1.sql` | 20260514190000 | delegation chain v1 | (alters existing objects) | yes | no |
| 31 | `20260514193000_agent_identity_scoped_access_v1.sql` | 20260514193000 | agent identity scoped access v1 | ai_agents, ai_agent_scopes | yes | no |
| 32 | `20260515000000_agent_attestation_nonces.sql` | 20260515000000 | agent attestation nonces | agent_attestation_nonces | yes | no |
| 33 | `20260515100000_rls_governance_fixes.sql` | 20260515100000 | rls governance fixes | (alters existing objects) | yes | no |
| 34 | `20260515200000_storage_bucket_setup.sql` | 20260515200000 | storage bucket setup | (alters existing objects) | yes | no |
| 35 | `20260518000000_quota_atomicity.sql` | 20260518000000 | quota atomicity | quota_reservations | yes | yes |
| 36 | `20260520000000_vault_digestive_system.sql` | 20260520000000 | vault digestive system | vault_digestion_runs, vault_nutrients, vault_semantic_residue | yes | no |
| 37 | `20260520010000_vault_learned_patterns.sql` | 20260520010000 | vault learned patterns | vault_learned_patterns, vault_learned_pattern_evidence | yes | no |
| 38 | `20260520113000_vault_intervention_memory.sql` | 20260520113000 | vault intervention memory | vault_interventions, vault_intervention_evidence, vault_intervention_outcomes | yes | no |
| 39 | `20260521110000_runtime_conversation_state.sql` | 20260521110000 | runtime conversation state | runtime_conversation_state | yes | no |
| 40 | `20260521123000_create_intervention_memory.sql` | 20260521123000 | create intervention memory | intervention_memory | yes | no |
| 41 | `20260522000000_operational_runtime_memory.sql` | 20260522000000 | operational runtime memory | operational_memory_runtime_records, operational_intervention_records | yes | no |
| 42 | `20260522100000_operational_memory_nutrient_links.sql` | 20260522100000 | operational memory nutrient links | operational_memory_nutrient_links | yes | no |
| 43 | `20260526000000_create_dashboard_source_snapshots.sql` | 20260526000000 | create dashboard source snapshots | dashboard_source_snapshots | yes | no |
| 44 | `20260527090000_workspace_runtime_state.sql` | 20260527090000 | workspace runtime state | workspace_runtime_state | yes | no |
| 45 | `20260527091000_workspace_governance.sql` | 20260527091000 | workspace governance | workspace_governance | yes | no |
| 46 | `20260528000000_pmo_team_invites.sql` | 20260528000000 | pmo team invites | pmo_team_invites | yes | no |
| 47 | `20260601000000_schema_contract_hardening.sql` | 20260601000000 | schema contract hardening | (alters existing objects) | yes | no |
| 48 | `20260602000000_operational_governance_briefs.sql` | 20260602000000 | operational governance briefs | operational_governance_briefs | yes | no |
| 49 | `20260602010000_vault_intake_reliability.sql` | 20260602010000 | vault intake reliability | vault_documents, vault_operational_signals | yes | no |
| 50 | `20260602020000_raid_auto_extraction.sql` | 20260602020000 | raid auto extraction | raid_items | yes | no |
| 51 | `20260605000000_project_evidence.sql` | 20260605000000 | project evidence | project_evidence | yes | no |
| 52 | `20260605010000_project_evidence_content.sql` | 20260605010000 | project evidence content | project_evidence_content | yes | no |
| 53 | `20260605020000_project_discovery.sql` | 20260605020000 | project discovery | project_discovery | yes | no |
| 54 | `20260605030000_project_discovery_payload_hash.sql` | 20260605030000 | project discovery payload hash | (alters existing objects) | yes | no |
| 55 | `20260605040000_recommended_actions.sql` | 20260605040000 | recommended actions | recommended_actions | yes | no |
| 56 | `20260605050000_recommended_actions_decision_workflow.sql` | 20260605050000 | recommended actions decision workflow | recommended_action_decisions | yes | no |
| 57 | `20260605060000_task_drafts.sql` | 20260605060000 | task drafts | task_drafts | yes | no |
| 58 | `20260605070000_execution_tasks.sql` | 20260605070000 | execution tasks | execution_tasks, execution_task_events | yes | no |
| 59 | `20260605080000_execution_task_dependencies.sql` | 20260605080000 | execution task dependencies | execution_task_dependencies | yes | no |
| 60 | `20260605090000_milestones_schedule_foundation.sql` | 20260605090000 | milestones schedule foundation | project_milestones | yes | no |
| 61 | `20260605100000_critical_path_schedule_variance.sql` | 20260605100000 | critical path schedule variance | (alters existing objects) | yes | no |
| 62 | `20260611000000_operational_evidence_decision_loop.sql` | 20260611000000 | operational evidence decision loop | evidence_items, operational_signals, risk_issue_records, governance_events, oper | yes | no |
| 63 | `20260616000000_platform_events_foundation.sql` | 20260616000000 | platform events foundation | platform_events | yes | no |
| 64 | `20260616000001_platform_events_invariants.sql` | 20260616000001 | platform events invariants | platform_events | yes | no |
| 65 | `20260616000002_platform_events_p0_hardening.sql` | 20260616000002 | platform events p0 hardening | (alters existing objects) | yes | no |
| 66 | `20260616000003_evidence_linked_decisions.sql` | 20260616000003 | evidence linked decisions | project_decisions, project_decision_evidence_links, decision_outcome_links | yes | no |
| 67 | `20260617000000_constitutional_decision_lifecycle.sql` | 20260617000000 | constitutional decision lifecycle | decision_outcomes | yes | no |
| 68 | `20260617010000_organizational_memory_foundation.sql` | 20260617010000 | organizational memory foundation | organizational_memory, organizational_memory_sources | yes | no |
| 69 | `20260617020000_organizational_pattern_foundation.sql` | 20260617020000 | organizational pattern foundation | organizational_patterns, organizational_pattern_sources, organizational_pattern_ | yes | no |
| 70 | `20260617030000_decision_effectiveness_foundation.sql` | 20260617030000 | decision effectiveness foundation | decision_effectiveness, decision_effectiveness_observations | yes | no |
| 71 | `20260617040000_personal_pm_memory_foundation.sql` | 20260617040000 | personal pm memory foundation | personal_pm_memory, personal_pm_memory_sources, personal_pm_memory_observations | yes | no |
| 72 | `20260618000000_pattern_extraction_foundation.sql` | 20260618000000 | pattern extraction foundation | organizational_pattern_candidates, pattern_candidate_sources, pattern_extraction | yes | no |
| 73 | `20260619000000_personal_pm_patterns_foundation.sql` | 20260619000000 | personal pm patterns foundation | personal_pm_patterns, personal_pm_pattern_sources, personal_pm_pattern_observati | yes | no |
| 74 | `20260619000001_constitutional_memory_foundation.sql` | 20260619000001 | constitutional memory foundation | constitutional_artifacts, constitutional_memory_records, constitutional_memory_l | yes | no |
| 75 | `20260619000002_constitutional_digest_engine.sql` | 20260619000002 | constitutional digest engine | constitutional_digests, constitutional_digest_classifications | partial | no |
| 76 | `20260620000000_personal_pm_effectiveness_foundation.sql` | 20260620000000 | personal pm effectiveness foundation | personal_pm_effectiveness, personal_pm_effectiveness_sources, personal_pm_effect | yes | no |
| 77 | `20260621000000_personal_pattern_extraction_foundation.sql` | 20260621000000 | personal pattern extraction foundation | personal_pm_pattern_candidates, personal_pm_pattern_extraction_runs, personal_pm | yes | no |
| 78 | `20260622000000_intelligence_bridge_foundation.sql` | 20260622000000 | intelligence bridge foundation | intelligence_bridge_links, intelligence_bridge_sources, intelligence_bridge_obse | yes | no |
| 79 | `20260622000001_constitutional_learning_engine.sql` | 20260622000001 | constitutional learning engine | constitutional_learning_patterns, constitutional_learning_evidence, constitution | yes | no |
| 80 | `20260622000002_sovereign_recommendation_engine.sql` | 20260622000002 | sovereign recommendation engine | constitutional_recommendations, constitutional_recommendation_evidence, constitu | yes | no |
| 81 | `20260622000003_recommendation_effectiveness_engine.sql` | 20260622000003 | recommendation effectiveness engine | constitutional_recommendation_outcomes, constitutional_recommendation_feedback,  | yes | no |
| 82 | `20260623000000_pm_registry_foundation.sql` | 20260623000000 | pm registry foundation | project_managers, pm_assignments, pm_profiles | yes | no |
| 83 | `20260623000001_project_constitution_foundation.sql` | 20260623000001 | project constitution foundation | project_constitution_profiles | yes | no |
| 84 | `20260623000002_project_constitution_lifecycle.sql` | 20260623000002 | project constitution lifecycle | project_constitutions, constitution_lifecycle_history | yes | no |
| 85 | `20260624000000_project_constitution_amendment_governance.sql` | 20260624000000 | project constitution amendment governance | constitution_amendments, constitution_amendment_changes, constitution_snapshots | yes | no |
| 86 | `20260625000000_project_constitutional_decision_governance.sql` | 20260625000000 | project constitutional decision governance | constitutional_decisions, constitutional_decision_options, constitutional_decisi | yes | no |
| 87 | `20260626000000_constitutional_ratification_framework.sql` | 20260626000000 | constitutional ratification framework | constitutional_signatures, constitutional_signature_requests, constitutional_rat | yes | no |
| 88 | `20260627000000_authority_registry_governance.sql` | 20260627000000 | authority registry governance | authority_registrations, authority_delegations, governance_violations, authority | yes | no |
| 89 | `20260627000001_authority_registry_hardening.sql` | 20260627000001 | authority registry hardening | (alters existing objects) | yes | no |
| 90 | `20260628000000_programs.sql` | 20260628000000 | programs | programs | partial | no |
| 91 | `20260628050000_program_roadmap_sources.sql` | 20260628050000 | program roadmap sources | program_roadmap_sources | partial | no |
| 92 | `20260629000000_program_hierarchy.sql` | 20260629000000 | program hierarchy | program_epics, program_sprints, program_cards | partial | no |
| 93 | `20260630000000_program_roadmap_parse_results.sql` | 20260630000000 | program roadmap parse results | program_roadmap_parse_results | partial | no |
| 94 | `20260701000000_program_materializations.sql` | 20260701000000 | program materializations | program_materializations | yes | no |
| 95 | `20260702000000_command_center_governance_foundation.sql` | 20260702000000 | command center governance foundation | (alters existing objects) | yes | no |
| 96 | `20260702000001_program_execution_board.sql` | 20260702000001 | program execution board | (alters existing objects) | yes | no |
| 97 | `20260703000000_program_card_context_projection.sql` | 20260703000000 | program card context projection | (alters existing objects) | yes | no |
| 98 | `20260704000000_governance_signal_engine.sql` | 20260704000000 | governance signal engine | governance_signals, governance_signal_evidence, governance_signal_recommendation | yes | no |
| 99 | `20260705000000_governance_action_engine.sql` | 20260705000000 | governance action engine | governance_actions, governance_action_evidence, governance_action_assignments | yes | no |
| 100 | `20260706000000_governance_commitment_engine.sql` | 20260706000000 | governance commitment engine | governance_commitments, governance_commitment_history, governance_commitment_del | yes | no |
| 101 | `20260707000000_execution_projection_engine.sql` | 20260707000000 | execution projection engine | execution_projections, execution_projection_tasks, execution_projection_dependen | yes | no |
| 102 | `20260708000000_execution_reality_engine.sql` | 20260708000000 | execution reality engine | execution_realities, execution_variances, execution_observations, execution_drif | yes | no |
| 103 | `20260709000000_project_operating_system.sql` | 20260709000000 | project operating system | project_os_snapshots, project_os_attention_items, project_os_context_links | yes | no |
| 104 | `20260710000000_operational_command_center.sql` | 20260710000000 | operational command center | operational_command_centers, operational_focus_items, operational_focus_links | yes | no |
| 105 | `20260711000000_operational_consequence_engine.sql` | 20260711000000 | operational consequence engine | operational_consequences, operational_consequence_impacts, operational_consequen | yes | no |
| 106 | `20260712000000_operational_decision_engine.sql` | 20260712000000 | operational decision engine | operational_decisions, operational_decision_options, operational_decision_evalua | yes | no |
| 107 | `20260713000000_operational_decision_outcome_engine.sql` | 20260713000000 | operational decision outcome engine | operational_decision_outcomes, operational_outcome_observations, operational_out | yes | no |
| 108 | `20260714000000_personal_portfolio_foundation.sql` | 20260714000000 | personal portfolio foundation | personal_portfolios, personal_portfolio_projects, personal_portfolio_snapshots,  | yes | no |
| 109 | `20260715000000_pm_performance_engine.sql` | 20260715000000 | pm performance engine | pm_performance_snapshots, pm_performance_metrics, pm_performance_evidence | yes | no |
| 110 | `20260716000000_pm_capacity_load_intelligence.sql` | 20260716000000 | pm capacity load intelligence | pm_capacity_snapshots, pm_capacity_metrics, pm_capacity_evidence | yes | no |
| 111 | `20260717000000_pmo_governance_compliance_engine.sql` | 20260717000000 | pmo governance compliance engine | governance_compliance_snapshots, governance_compliance_gaps, governance_complian | yes | no |
| 112 | `20260718000000_pmo_command_center.sql` | 20260718000000 | pmo command center | pmo_command_center_snapshots, pmo_attention_items, pmo_recommendations | yes | no |
| 113 | `20260719000000_pmo_intervention_actions.sql` | 20260719000000 | pmo intervention actions | pmo_intervention_actions | yes | no |
| 114 | `20260725000000_pmo_executive_reporting.sql` | 20260725000000 | pmo executive reporting | pmo_executive_reports, pmo_alert_payloads | yes | no |
| 115 | `20260726000000_agent_tool_registry.sql` | 20260726000000 | agent tool registry | agent_tools, agent_tool_assignments | yes | no |
| 116 | `20260727000000_agent_permission_approval_layer.sql` | 20260727000000 | agent permission approval layer | agent_tool_requests, agent_tool_approvals, agent_tool_approval_events | yes | no |
| 117 | `20260728000000_agent_memory_context_layer.sql` | 20260728000000 | agent memory context layer | agent_context_policies, agent_memory_records, agent_memory_events, agent_context | yes | no |
| 118 | `20260729000000_agent_observability_audit_trail.sql` | 20260729000000 | agent observability audit trail | agent_audit_events, agent_decision_events, agent_audit_exports | yes | no |
| 119 | `20260730000000_agent_execution_request_runtime.sql` | 20260730000000 | agent execution request runtime | agent_execution_requests, agent_execution_events | yes | no |
| 120 | `20260731000000_agent_tool_execution_adapter_layer.sql` | 20260731000000 | agent tool execution adapter layer | agent_tool_adapter_executions, agent_tool_adapter_execution_events | yes | no |
| 121 | `20260801000000_agent_execution_results_evidence_layer.sql` | 20260801000000 | agent execution results evidence layer | agent_execution_results, agent_execution_evidence_items, agent_execution_result_ | yes | no |
| 122 | `20260802000000_agent_human_review_action_inbox.sql` | 20260802000000 | agent human review action inbox | agent_review_queues, agent_review_items, agent_review_assignments, agent_review_ | yes | no |
| 123 | `20260803000000_agent_controlled_action_conversion_approval_bridge.sql` | 20260803000000 | agent controlled action conversion approval bridge | agent_action_conversions, agent_action_conversion_preflights, agent_action_appro | yes | no |
| 124 | `20260804000000_agent_controlled_execution_finalization_adapter_dispatch_gate.sql` | 20260804000000 | agent controlled execution finalization adapter dispatch gate | agent_execution_finalizations, agent_execution_dispatch_gates, agent_execution_d | yes | no |
| 125 | `20260805000000_agent_controlled_execution_result_reconciliation_human_outcome_review.sql` | 20260805000000 | agent controlled execution result reconciliation human outcome review | agent_execution_outcomes, agent_execution_outcome_reconciliations, agent_executi | yes | no |
| 126 | `20260806000000_agent_controlled_execution_learning_signals_governance_feedback_loop.sql` | 20260806000000 | agent controlled execution learning signals governance feedback loop | agent_execution_learning_signals, agent_execution_learning_extractions, agent_ex | yes | no |
| 127 | `20260807000000_agent_controlled_pmo_governance_intelligence_dashboard.sql` | 20260807000000 | agent controlled pmo governance intelligence dashboard | agent_pmo_governance_dashboard_snapshots, agent_pmo_governance_insight_cards, ag | yes | no |
| 128 | `20260808000000_agent_pmo_governance_proposal_review_controlled_policy_change_backlog.sql` | 20260808000000 | agent pmo governance proposal review controlled policy change backlog | agent_pmo_policy_backlog_items, agent_pmo_policy_change_requests, agent_pmo_poli | yes | no |
| 129 | `20260809000000_agent_controlled_governance_policy_simulation_report_pmo_approval_pack.sql` | 20260809000000 | agent controlled governance policy simulation report pmo approval pack | agent_pmo_simulation_reports, agent_pmo_simulation_report_sections, agent_pmo_po | yes | no |
| 130 | `20260810000000_agent_controlled_policy_implementation_planning_workspace.sql` | 20260810000000 | agent controlled policy implementation planning workspace | agent_pmo_approval_packs, agent_pmo_signoff_packets, agent_pmo_implementation_ti | yes | no |
| 131 | `20260811000000_agent_controlled_policy_implementation_gate_dry_run_change_executor.sql` | 20260811000000 | agent controlled policy implementation gate dry run change executor | agent_pmo_dry_run_execution_requests, agent_pmo_dry_run_preflight_validations, a | yes | no |
| 132 | `20260812000000_agent_controlled_policy_version_activation_rollback_gate.sql` | 20260812000000 | agent controlled policy version activation rollback gate | agent_pmo_policy_activation_requests, agent_pmo_policy_activation_preconditions, | yes | no |
| 133 | `20260813000000_agent_controlled_project_intelligence_handoff.sql` | 20260813000000 | agent controlled project intelligence handoff | agent_pmo_project_handoff_requests, agent_pmo_project_context_validations, agent | yes | no |
| 134 | `20260814000000_agent_end_to_end_governance_runtime_integration_hardening.sql` | 20260814000000 | agent end to end governance runtime integration hardening | agent_pmo_runtime_hardening_runs, agent_pmo_layer_integration_audits, agent_pmo_ | yes | no |
| 135 | `20260815000000_agent_beta_onboarding_demo_data_tenant_readiness.sql` | 20260815000000 | agent beta onboarding demo data tenant readiness | agent_beta_readiness_plans, agent_beta_workspace_readiness, agent_demo_data_bund | yes | no |
| 136 | `20260816000000_playbook_engine_materialization_phase1.sql` | 20260816000000 | playbook engine materialization phase1 | playbook_snapshots, playbook_recommendations, playbook_audit_events | yes | no |
| 137 | `20260817000000_stripe_webhook_lifecycle_hardening.sql` | 20260817000000 | stripe webhook lifecycle hardening | (alters existing objects) | yes | no |
| 138 | `20260818000000_supabase_rls_service_role_boundary_hardening.sql` | 20260818000000 | supabase rls service role boundary hardening | (alters existing objects) | yes | no |
| 139 | `20260819000000_abuse_rate_limits.sql` | 20260819000000 | abuse rate limits | abuse_rate_limits | yes | no |
| 140 | `20260820000000_workspace_invite_token_hashing.sql` | 20260820000000 | workspace invite token hashing | (alters existing objects) | yes | no |
| 141 | `20260821000000_ai_usage_events.sql` | 20260821000000 | ai usage events | ai_usage_events | yes | no |
| 142 | `20260822000000_dashboard_task_lifecycle.sql` | 20260822000000 | dashboard task lifecycle | dashboard_task_lifecycle_records, dashboard_task_lifecycle_events | yes | no |
| 143 | `20260823000000_fix_capability_verification_evidence_rls_gap.sql` | 20260823000000 | fix capability verification evidence rls gap | (alters existing objects) | partial | no |
| 144 | `20260823000001_fix_workspace_memberships_rls_recursion.sql` | 20260823000001 | fix workspace memberships rls recursion | (alters existing objects) | yes | no |
| 145 | `20260824000000_fix_purge_expired_nonces_search_path.sql` | 20260824000000 | fix purge expired nonces search path (Perilla 13B) | (alters existing objects) | yes | no |
| 146 | `20260825000000_fix_security_definer_public_execute_grants.sql` | 20260825000000 | fix security definer public execute grants (Perilla 13B) | (alters existing objects) | yes | no |
| 147 | `20260826000000_fix_agent_attestation_nonces_grants.sql` | 20260826000000 | fix agent attestation nonces grants (Pilot Gate Sprint 01) | (alters existing objects) | yes | no |
| 148 | `20260827000000_pilot_agreement_acceptances.sql` | 20260827000000 | pilot agreement acceptances (Pilot Gate Sprint 01, Task 9) | pilot_agreement_acceptances | yes | no |
| 149 | `20260828000000_founder_program.sql` | 20260828000000 | Founder Circle Program Sprint 01 — settings, invitations, participants, applications, transitions, checkpoints, events, feedback, discovery sessions, decisions + `founder_program_transition` SECURITY DEFINER function | founder_program_settings, founder_invitations, founder_participants, founder_applications, founder_membership_transitions, founder_onboarding_checkpoints, founder_program_events, founder_feedback, founder_discovery_sessions, founder_program_decisions | yes | no |
