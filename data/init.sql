create table massifs
(
    name text not null,
    code integer
);

create table recipients
(
    number varchar(12) not null
        unique
);

create table bra_subscriptions
(
    recipient varchar(12) not null,
    massif    integer
);

create table bras
(
    massif     integer     not null,
    date       varchar(10) not null,
    filename   text        not null,
    public_url text        not null
);

create table deliveries_bras
(
    recipient varchar(12) not null,
    massif    integer     not null,
    date      integer     not null,
    timestamp timestamp
);
