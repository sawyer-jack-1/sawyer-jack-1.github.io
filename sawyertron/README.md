# SawyerTRON

SawyerTRON collects arXiv metadata once each morning and publishes a neutral,
searchable digest. It never downloads papers and never publishes a score or an
AI assessment. Titles link directly to arXiv.

## Customize it

Edit [`config.yml`](config.yml). This single file contains:

- the arXiv categories to collect;
- topic phrases and their private ranking weights;
- author names to prioritize;
- the minimum inclusion threshold and daily limit; and
- collection and backfill settings.

Weights only affect which entries appear and their order. They are not included
in the public data files.

## Update or backfill

The GitHub Actions workflow runs automatically at 6:17 AM Pacific. It can also
be started manually from the repository's **Actions** tab. Enter the number of
days to fetch when starting a manual run; `30` refreshes the initial month.

For a local run:

```sh
python -m pip install -r sawyertron/requirements.txt
python sawyertron/update.py --days 30
```

Generated public data lives in `assets/sawyertron/data/`, split into one JSON
file per month.

## Verify locally

```sh
python -m unittest discover -s sawyertron -p 'test_*.py'
bundle install
bundle exec jekyll serve
```

Then open `http://127.0.0.1:4000/sawyertron.html`.
