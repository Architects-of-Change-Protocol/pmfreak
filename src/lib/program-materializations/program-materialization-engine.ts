import type { ProgramRoadmapParseResult } from "@/lib/program-roadmap-parser/types";
import type {
  MaterializationPlan,
  MaterializeCardPlan,
  MaterializeEpicPlan,
  MaterializeSprintPlan,
} from "./types";

export function buildMaterializationPlan(
  parseResult: ProgramRoadmapParseResult
): MaterializationPlan {
  const epics: MaterializeEpicPlan[] = [];
  const sprints: MaterializeSprintPlan[] = [];
  const cards: MaterializeCardPlan[] = [];
  const warnings: string[] = [];

  for (const parsedEpic of parseResult.epics) {
    if (!parsedEpic.title.trim()) {
      warnings.push(`Epic ${parsedEpic.number}: empty title, skipped.`);
      continue;
    }

    epics.push({
      number: parsedEpic.number,
      title: parsedEpic.title.trim(),
      orderIndex: parsedEpic.number - 1,
    });

    for (const parsedSprint of parsedEpic.sprints) {
      if (!parsedSprint.title.trim()) {
        warnings.push(
          `Sprint ${parsedSprint.number} in Epic ${parsedEpic.number}: empty title, skipped.`
        );
        continue;
      }

      const objective =
        parsedSprint.prompt?.sections?.objective?.trim() ?? null;

      sprints.push({
        number: parsedSprint.number,
        epicNumber: parsedEpic.number,
        title: parsedSprint.title.trim(),
        objective: objective ?? null,
        orderIndex: parsedSprint.number - 1,
      });

      const sections = parsedSprint.prompt?.sections;
      if (!sections) continue;

      let cardOrder = 0;

      for (const capability of sections.capabilities) {
        const title = capability.trim();
        if (!title) {
          warnings.push(
            `Sprint ${parsedSprint.number}: empty capability, skipped.`
          );
          continue;
        }
        cards.push({
          sprintNumber: parsedSprint.number,
          epicNumber: parsedEpic.number,
          title,
          type: "TASK",
          materializationType: "CAPABILITY",
          sourceLineNumber: null,
          orderIndex: cardOrder++,
        });
      }

      for (const deliverable of sections.deliverables) {
        const title = deliverable.trim();
        if (!title) {
          warnings.push(
            `Sprint ${parsedSprint.number}: empty deliverable, skipped.`
          );
          continue;
        }
        cards.push({
          sprintNumber: parsedSprint.number,
          epicNumber: parsedEpic.number,
          title,
          type: "DELIVERABLE",
          materializationType: "DELIVERABLE",
          sourceLineNumber: null,
          orderIndex: cardOrder++,
        });
      }
    }
  }

  return { epics, sprints, cards, warnings };
}
