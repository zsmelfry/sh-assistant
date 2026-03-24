import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { smPoints } from './startup-map';

// ===== 歌曲库 =====
export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  album: text('album'),
  year: integer('year'),
  genre: text('genre'),
  lyrics: text('lyrics'),
  notes: text('notes'),
  sheetMusic: text('sheet_music'),
  youtubeUrl: text('youtube_url'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_songs_artist').on(table.artist),
  index('idx_songs_year').on(table.year),
]);

// ===== 知识点-歌曲关联 =====
export const smPointSongs = sqliteTable('sm_point_songs', {
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  songId: integer('song_id').notNull()
    .references(() => songs.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.pointId, table.songId] }),
]);
