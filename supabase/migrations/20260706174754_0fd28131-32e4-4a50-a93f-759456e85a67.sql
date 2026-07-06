UPDATE public.charge_item
   SET status = 'collected'
 WHERE id = '00000000-0000-0000-0000-00000000d042'
   AND status = 'ordered';