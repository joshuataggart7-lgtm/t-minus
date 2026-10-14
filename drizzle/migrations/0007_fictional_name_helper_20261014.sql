CREATE OR REPLACE FUNCTION public.fictionalize_20261014(s text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(s,
  'Michael Collins (fictional CO)','M. Corvane (fictional CO)'),'Michael Collins (fictional)','M. Corvane (fictional)'),
  'Jim Lovell','D. Okonkwo-Hale'),'John Young','S. Varnell'),'Pete Conrad','P. Castellan'),'Neil Armstrong','N. Ashgrove'),
  'Alan Shepard','A. Thorncroft'),'Fred Haise','F. Halberg'),'Charlie Duke','C. Wrenfield'),'Gene Cernan','G. Pellworth'),
  'John Glenn','J. Marrowby'),'Mae Jemison','M. Ostrander'),'Sally Ride','S. Brantwood'),'Wally Schirra','W. Delacorte'),
  'Frank Borman','F. Ashmere'),'Ken Mattingly','K. Tolliver'),'Jack Swigert','J. Fennimore'),'Scott Carpenter','S. Haldane'),
  'Eileen Collins','E. Strathmore'),'Ellen Ochoa','E. Marchetti'),'Joshua Taggart','J. Tarrance (fictional)'),'J. Taggart','J. Tarrance (fictional)')
$$;
REVOKE ALL ON FUNCTION public.fictionalize_20261014(text) FROM PUBLIC, anon, authenticated;