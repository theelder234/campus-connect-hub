CREATE TABLE public.study_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'text',
  summary text NOT NULL,
  key_points text[] NOT NULL DEFAULT '{}',
  flashcards jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_notes TO authenticated;
GRANT ALL ON public.study_notes TO service_role;

ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own study notes" ON public.study_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX study_notes_user_created_idx ON public.study_notes (user_id, created_at DESC);