-- P1: Link skill_configs to ability skills
-- P2: Link habits and planner_goals to ability skills
ALTER TABLE skill_configs ADD COLUMN linked_ability_skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL;
ALTER TABLE habits ADD COLUMN linked_ability_skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL;
ALTER TABLE planner_goals ADD COLUMN linked_ability_skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL;
