-- Rename column and update to reference vendors
ALTER TABLE public.project_livecom_events
  RENAME COLUMN fabrication_av_vendor TO vendor_hotel_id;

-- Add foreign key to vendors table
ALTER TABLE public.project_livecom_events
  ALTER COLUMN vendor_hotel_id TYPE UUID USING vendor_hotel_id::uuid;

ALTER TABLE public.project_livecom_events
  ADD CONSTRAINT project_livecom_events_vendor_hotel_id_fkey 
  FOREIGN KEY (vendor_hotel_id) REFERENCES public.vendors(id);