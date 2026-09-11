ALTER TABLE public.nf1707_fields
  ADD COLUMN IF NOT EXISTS caption_full text,
  ADD COLUMN IF NOT EXISTS nearest_form_text_full text,
  ADD COLUMN IF NOT EXISTS choice_items text,
  ADD COLUMN IF NOT EXISTS is_answerable text;

UPDATE public.nf1707_fields
SET caption_full = COALESCE(caption_full, caption),
    nearest_form_text_full = COALESCE(nearest_form_text_full, nearest_form_text),
    is_answerable = COALESCE(is_answerable, 'yes');