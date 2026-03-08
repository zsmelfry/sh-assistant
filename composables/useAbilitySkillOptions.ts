/**
 * Fetches active ability skills for use in link/select dropdowns.
 * Shared by HabitForm, GoalForm, SkillWizard, and any form
 * that needs a list of ability skills to link to.
 */
export function useAbilitySkillOptions() {
  const skills = ref<Array<{ id: number; name: string; categoryName: string }>>([]);

  onMounted(async () => {
    try {
      skills.value = await $fetch<Array<{ id: number; name: string; categoryName: string }>>(
        '/api/ability-skills?status=active',
      );
    } catch {
      // Ability module may not have data yet
    }
  });

  return { abilitySkills: skills };
}
