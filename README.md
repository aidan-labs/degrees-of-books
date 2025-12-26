# Degrees of Books

Find the shortest path between any two books through their similar books connections via the Goodreads book dataset.

## About

This project visualizes the connection network between books using data from Goodreads. Each book is a node that connects to other "similar" books as determined by the Goodreads dataset (subjective from users), creating network graph.

The graph structure includes:
- **Multiple connections per node** - books link to several similar books
- **Directed flow** — arrows show the path direction
- **Color-coded distances** - node colors represent degrees of separation from the start

## Data Source

The book data comes from the [UCSD Book Graph dataset](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html), specifically the "Detailed book graph" (`goodreads_books.json.gz`, ~2.3M books).

After downloading, I ran `process_goodreads_books.py` to process the data into a more usable format for this use-case (~670,000 books).

## Note on Connections

This site visualizes the connections between books through their "similar books" relationships. All book connections are subjective. They are based on what Goodreads users considered "similar books." The resulting network is messy, but I think it is a fun way to find new books given two books you liked.

## Acknowledgments

Inspired by [Six Degrees of Wikipedia](https://www.sixdegreesofwikipedia.com).

This project uses data from the UCSD Book Graph dataset.

* Mengting Wan, Julian McAuley, "Item Recommendation on Monotonic Behavior Chains", in RecSys'18.
* Mengting Wan, Rishabh Misra, Ndapa Nakashole, Julian McAuley, "Fine-Grained Spoiler Detection from Large-Scale Review Corpora", in ACL'19.