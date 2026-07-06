-- M03: Scheduling + referral enum types.
-- Must precede referral tables (M12) and clinic_bookings extensions (Step 3).
CREATE TYPE public.booking_source AS ENUM ('opd','referral','follow_up','call_center','portal');
CREATE TYPE public.visit_type AS ENUM ('new_consult','follow_up','series','no_charge','procedure');
CREATE TYPE public.slot_status AS ENUM ('open','held','booked','blocked','cancelled');
CREATE TYPE public.referral_class AS ENUM ('intra','inter_company','external','cross_encounter');
CREATE TYPE public.target_kind AS ENUM ('specialty','provider','facility','service');
CREATE TYPE public.charge_mode AS ENUM ('new_consult','follow_up','series','no_charge');
CREATE TYPE public.referral_status AS ENUM ('draft','submitted','accepted','declined','completed','cancelled');