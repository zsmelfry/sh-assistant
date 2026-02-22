import type { Component } from 'vue';
import {
  BookOpen, Map, Code, Music, Palette, Camera,
  Globe, Briefcase, Heart, Brain, Lightbulb, Rocket,
  Target, TrendingUp, Users, Zap, Coffee, Compass,
  Cpu, Database, Feather, Film, Flame, Gamepad2,
  GraduationCap, Hammer, Headphones, Leaf, PenTool, Shield,
} from 'lucide-vue-next';

const ICON_MAP: Record<string, Component> = {
  BookOpen, Map, Code, Music, Palette, Camera,
  Globe, Briefcase, Heart, Brain, Lightbulb, Rocket,
  Target, TrendingUp, Users, Zap, Coffee, Compass,
  Cpu, Database, Feather, Film, Flame, Gamepad2,
  GraduationCap, Hammer, Headphones, Leaf, PenTool, Shield,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function resolveIcon(name: string): Component {
  return ICON_MAP[name] || BookOpen;
}
