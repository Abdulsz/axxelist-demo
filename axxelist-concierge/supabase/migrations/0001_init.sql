create extension if not exists vector;

create table if not exists listings (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null,
 address text not null,
 city text not null default 'Oakland',
 state text not null default 'CA',
 zip text,
 neighborhood text not null,
 lat double precision not null,
 lng double precision not null,
 price int not null,
 bedrooms numeric not null,
 bathrooms numeric not null,
 sqft int,
 property_type text not null check (property_type in ('apartment','condo','loft')),
 amenities text[] not null default '{}',
 photos text[] not null default '{}',
 pet_policy text not null,
 transit_distance_mi numeric,
 walk_score int,
 created_at timestamptz not null default now()
);

create index if not exists listings_city_state_idx on listings (city, state);
create index if not exists listings_price_idx on listings (price);
create index if not exists listings_bedrooms_idx on listings (bedrooms);
create index if not exists listings_neighborhood_idx on listings (neighborhood);

create table if not exists listing_embeddings (
 listing_id uuid primary key references listings(id) on delete cascade,
 embedding vector(1536) not null,
 content text not null
);

create index if not exists listing_embeddings_hnsw_idx
  on listing_embeddings using hnsw (embedding vector_cosine_ops);

create or replace function match_listings(
 query_embedding vector(1536),
 match_count int default 10,
 min_price int default 0,
 max_price int default 100000,
 min_bedrooms numeric default 0,
 required_pets text default null
)
returns table (
 id uuid,
 similarity float
)
language sql
stable
as $$
 select
   l.id,
   1 - (e.embedding <=> query_embedding) as similarity
 from listing_embeddings e
 join listings l on l.id = e.listing_id
 where l.price between min_price and max_price
   and l.bedrooms >= min_bedrooms
   and (
     required_pets is null
     or l.pet_policy = 'both'
     or l.pet_policy = required_pets
   )
 order by e.embedding <=> query_embedding
 limit match_count;
$$;
