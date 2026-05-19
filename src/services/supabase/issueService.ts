import { supabase } from './supabase';
import type { Json, Tables } from '../../types/database.types';

export type IssueData = Pick<Tables<'issues'>, 'id' | 'title' | 'goal_image_url' | 'target_concerns'>;
export type IssueListItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string | null;
  entries: { entry_date: string }[];
};

export async function fetchUserIssues(userId: string): Promise<IssueListItem[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('id, title, description, created_at, entries(entry_date)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchUserIssues failed: ${error.message}`);
  return (data ?? []) as unknown as IssueListItem[];
}
export type EntryData = Pick<Tables<'entries'>, 'id' | 'entry_date' | 'photo_url' | 'analysis_scores' | 'delta_scores' | 'llm_summary'>;
export type Product = Pick<Tables<'products'>, 'name' | 'brand' | 'category'>;

export async function fetchIssue(issueId: string): Promise<IssueData> {
  const { data, error } = await supabase
    .from('issues')
    .select('id, title, goal_image_url, target_concerns')
    .eq('id', issueId)
    .single();
  if (error) throw new Error(`fetchIssue failed: ${error.message}`);
  return data as IssueData;
}

export async function fetchEntries(issueId: string): Promise<EntryData[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('id, entry_date, photo_url, analysis_scores, delta_scores')
    .eq('issue_id', issueId)
    .order('entry_date', { ascending: true });
  if (error) throw new Error(`fetchEntries failed: ${error.message}`);
  return (data ?? []) as EntryData[];
}

export async function fetchEntry(entryId: string): Promise<EntryData> {
  const { data, error } = await supabase
    .from('entries')
    .select('id, entry_date, photo_url, analysis_scores, delta_scores, llm_summary')
    .eq('id', entryId)
    .single();
  if (error) throw new Error(`fetchEntry failed: ${error.message}`);
  return data as EntryData;
}

export async function fetchProducts(issueId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('name, brand, category')
    .eq('issue_id', issueId);
  if (error) throw new Error(`fetchProducts failed: ${error.message}`);
  return (data ?? []) as Product[];
}

interface CreateIssueParams {
  userId: string;
  title: string;
  targetConcerns: string[];
  goalImageUrl: string;
  baselineScores: unknown;
}

export async function createIssue(params: CreateIssueParams): Promise<string> {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      user_id: params.userId,
      title: params.title,
      target_concerns: params.targetConcerns,
      goal_image_url: params.goalImageUrl,
      baseline_scores: params.baselineScores as Json,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createIssue failed: ${error.message}`);
  return data.id;
}

interface CreateEntryParams {
  issueId: string;
  userId: string;
  photoUrl: string;
  analysisScores: unknown;
  entryDate: string;
  llmSummary?: string | null;
}

export async function createEntry(params: CreateEntryParams): Promise<string> {
  const { data, error } = await supabase
    .from('entries')
    .insert({
      issue_id: params.issueId,
      user_id: params.userId,
      entry_date: params.entryDate,
      photo_url: params.photoUrl,
      analysis_scores: params.analysisScores as Json,
      delta_scores: null,
      llm_summary: params.llmSummary ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createEntry failed: ${error.message}`);
  return data.id;
}

interface CreateDayOneEntryParams {
  issueId: string;
  userId: string;
  photoUrl: string;
  analysisScores: unknown;
  entryDate: string;
  llmSummary?: string | null;
}

export async function createDayOneEntry(params: CreateDayOneEntryParams): Promise<void> {
  const today = params.entryDate;
  const { error } = await supabase
    .from('entries')
    .insert({
      issue_id: params.issueId,
      user_id: params.userId,
      entry_date: today,
      photo_url: params.photoUrl,
      analysis_scores: params.analysisScores as Json,
      delta_scores: null,
      llm_summary: params.llmSummary ?? null,
    });
  if (error) throw new Error(`createDayOneEntry failed: ${error.message}`);
}
