// Re-export shim — Sprint 1 public API.
// All implementation lives in constitution-service.ts (unified service).
export {
  createProjectConstitution,
  updateProjectConstitution,
  softDeleteProjectConstitution,
  getProjectConstitution,
  listProjectConstitutions,
  changeConstitutionStatus as changeProjectConstitutionStatus,
} from "./constitution-service";
