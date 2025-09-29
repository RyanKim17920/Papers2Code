# check_new_papers_august2025.py

import requests
import gzip
import json
import polars as pl
import logging
import io
import os
import ssl
import urllib3
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from tqdm import tqdm
import time

# Disable SSL warnings for Papers with Code
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- Configuration ---
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"
CUTOFF_DATE = "2025-08-01"  # Check for papers after August 2025
OUTPUT_FILE = "new_papers_after_august2025.json"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    """Downloads, decompresses, and parses JSON data from a gzipped URL."""
    logging.info("Downloading data from %s", url)
    try:
        # Use verify=False to bypass SSL issues with Papers with Code
        response = requests.get(url, timeout=300, verify=False)
        response.raise_for_status()
        with gzip.open(io.BytesIO(response.content), mode='rt', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, list):
            logging.warning("Data from %s is not a list", url)
            return None
        logging.info("Successfully downloaded and parsed %d records from %s", len(data), url)
        return data
    except Exception as e:
        logging.error("Error processing %s: %s", url, e)
        return None

def analyze_paper_dates(abstracts_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze the distribution of paper dates in the dataset."""
    logging.info("Analyzing paper date distribution...")
    
    try:
        # Create a Polars LazyFrame for efficient processing
        abstracts_lf = pl.LazyFrame(abstracts_data)
        
        # Process dates and filter valid ones
        date_analysis_lf = (
            abstracts_lf
            .filter(pl.col("date").is_not_null())  # Remove null dates
            .filter(pl.col("date") != "")  # Remove empty string dates
            .with_columns([
                pl.col("date").str.strptime(pl.Date, "%Y-%m-%d", strict=False).alias("parsed_date")
            ])
            .filter(pl.col("parsed_date").is_not_null())  # Remove unparseable dates
        )
        
        # Get basic statistics
        stats = (
            date_analysis_lf
            .select([
                pl.col("parsed_date").min().alias("earliest_date"),
                pl.col("parsed_date").max().alias("latest_date"),
                pl.col("parsed_date").count().alias("total_papers_with_dates")
            ])
            .collect()
        )
        
        # Get papers by year for recent years
        yearly_counts = (
            date_analysis_lf
            .with_columns([
                pl.col("parsed_date").dt.year().alias("year")
            ])
            .filter(pl.col("year") >= 2020)  # Focus on recent years
            .group_by("year")
            .agg([
                pl.count().alias("paper_count")
            ])
            .sort("year", descending=True)
            .collect()
        )
        
        # Get monthly counts for 2025
        monthly_2025 = (
            date_analysis_lf
            .filter(pl.col("parsed_date").dt.year() == 2025)
            .with_columns([
                pl.col("parsed_date").dt.month().alias("month")
            ])
            .group_by("month")
            .agg([
                pl.count().alias("paper_count")
            ])
            .sort("month")
            .collect()
        )
        
        return {
            "stats": stats.to_dicts()[0] if stats.height > 0 else {},
            "yearly_counts": yearly_counts.to_dicts(),
            "monthly_2025": monthly_2025.to_dicts()
        }
        
    except Exception as e:
        logging.error(f"Error analyzing paper dates: {e}")
        return {}

def find_papers_after_cutoff(abstracts_data: List[Dict[str, Any]], cutoff_date: str) -> List[Dict[str, Any]]:
    """Find papers published after the cutoff date."""
    logging.info(f"Looking for papers published after {cutoff_date}...")
    
    try:
        # Create a Polars LazyFrame for efficient processing
        abstracts_lf = pl.LazyFrame(abstracts_data)
        
        # Filter papers after cutoff date
        new_papers_lf = (
            abstracts_lf
            .filter(pl.col("date").is_not_null())  # Must have a date
            .filter(pl.col("date") != "")  # Date cannot be empty
            .with_columns([
                pl.col("date").str.strptime(pl.Date, "%Y-%m-%d", strict=False).alias("parsed_date")
            ])
            .filter(pl.col("parsed_date").is_not_null())  # Must be parseable
            .filter(pl.col("parsed_date") > pl.lit(cutoff_date).str.strptime(pl.Date, "%Y-%m-%d"))
            .filter(pl.col("title").is_not_null() & (pl.col("title") != ""))  # Must have title
            .filter(pl.col("authors").is_not_null())  # Must have authors
            .select([
                pl.col("paper_url"),
                pl.col("title"),
                pl.col("abstract").fill_null(""),
                pl.col("authors"),
                pl.col("url_abs").fill_null(""),
                pl.col("url_pdf").fill_null(""),
                pl.col("arxiv_id").fill_null(""),
                pl.col("date"),
                pl.col("parsed_date"),
                pl.col("proceeding").alias("venue").fill_null(""),
                pl.col("tasks").fill_null([])
            ])
            .sort("parsed_date", descending=True)  # Most recent first
        )
        
        # Collect the results
        new_papers_df = new_papers_lf.collect()
        
        if new_papers_df.height == 0:
            logging.info("No papers found after the cutoff date.")
            return []
        
        logging.info(f"Found {new_papers_df.height} papers published after {cutoff_date}")
        
        # Convert to list of dictionaries for JSON serialization
        new_papers = new_papers_df.to_dicts()
        
        # Convert dates to strings for JSON serialization
        for paper in new_papers:
            if paper.get('parsed_date'):
                paper['parsed_date'] = paper['parsed_date'].isoformat()
                
        return new_papers
        
    except Exception as e:
        logging.error(f"Error filtering papers after cutoff: {e}")
        return []

def generate_summary_report(analysis_results: Dict[str, Any], new_papers: List[Dict[str, Any]]) -> str:
    """Generate a summary report of findings."""
    report_lines = [
        "=" * 60,
        "PAPERS WITH CODE DATA FRESHNESS REPORT",
        "=" * 60,
        f"Analysis Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"Cutoff Date: {CUTOFF_DATE}",
        ""
    ]
    
    # Overall statistics
    if analysis_results.get('stats'):
        stats = analysis_results['stats']
        report_lines.extend([
            "OVERALL DATASET STATISTICS:",
            f"  Total papers with valid dates: {stats.get('total_papers_with_dates', 'N/A'):,}",
            f"  Earliest paper date: {stats.get('earliest_date', 'N/A')}",
            f"  Latest paper date: {stats.get('latest_date', 'N/A')}",
            ""
        ])
    
    # Recent years distribution
    if analysis_results.get('yearly_counts'):
        report_lines.extend([
            "PAPERS BY YEAR (2020+):"
        ])
        for year_data in analysis_results['yearly_counts']:
            year = year_data.get('year', 'Unknown')
            count = year_data.get('paper_count', 0)
            report_lines.append(f"  {year}: {count:,} papers")
        report_lines.append("")
    
    # 2025 monthly distribution
    if analysis_results.get('monthly_2025'):
        report_lines.extend([
            "2025 MONTHLY DISTRIBUTION:"
        ])
        month_names = {
            1: "January", 2: "February", 3: "March", 4: "April",
            5: "May", 6: "June", 7: "July", 8: "August",
            9: "September", 10: "October", 11: "November", 12: "December"
        }
        for month_data in analysis_results['monthly_2025']:
            month = month_data.get('month', 0)
            count = month_data.get('paper_count', 0)
            month_name = month_names.get(month, f"Month {month}")
            report_lines.append(f"  {month_name}: {count:,} papers")
        report_lines.append("")
    
    # New papers after cutoff
    report_lines.extend([
        f"PAPERS PUBLISHED AFTER {CUTOFF_DATE}:",
        f"  Total found: {len(new_papers):,} papers",
        ""
    ])
    
    if new_papers:
        report_lines.extend([
            "RECENT PAPERS (Top 10):"
        ])
        for i, paper in enumerate(new_papers[:10]):
            title = paper.get('title', 'No title')[:80] + "..." if len(paper.get('title', '')) > 80 else paper.get('title', 'No title')
            date = paper.get('date', 'No date')
            venue = paper.get('venue', 'No venue')
            report_lines.append(f"  {i+1:2d}. [{date}] {title}")
            if venue:
                report_lines.append(f"      Venue: {venue}")
        
        if len(new_papers) > 10:
            report_lines.append(f"      ... and {len(new_papers) - 10} more papers")
        report_lines.append("")
    
    # Data freshness assessment
    latest_date = analysis_results.get('stats', {}).get('latest_date', '')
    if latest_date:
        try:
            latest_parsed = datetime.strptime(str(latest_date), '%Y-%m-%d').date()
            cutoff_parsed = datetime.strptime(CUTOFF_DATE, '%Y-%m-%d').date()
            
            report_lines.extend([
                "DATA FRESHNESS ASSESSMENT:",
                f"  Latest paper in dataset: {latest_date}",
                f"  Cutoff date for analysis: {CUTOFF_DATE}",
            ])
            
            if latest_parsed > cutoff_parsed:
                days_diff = (latest_parsed - cutoff_parsed).days
                report_lines.extend([
                    f"  ✅ Dataset appears FRESH - latest paper is {days_diff} days after cutoff",
                    f"  ✅ Papers published after August 2025 found: {len(new_papers)} papers"
                ])
            else:
                days_diff = (cutoff_parsed - latest_parsed).days
                report_lines.extend([
                    f"  ⚠️  Dataset may be STALE - latest paper is {days_diff} days before cutoff",
                    f"  ⚠️  No papers published after August 2025 found"
                ])
        except Exception as e:
            report_lines.append(f"  ❌ Could not assess data freshness: {e}")
    
    report_lines.extend([
        "",
        "=" * 60
    ])
    
    return "\n".join(report_lines)

def main():
    """Main function to check for new papers after August 2025."""
    start_time = time.time()
    logging.info("Starting Papers with Code data freshness check...")
    
    # Download the latest abstracts data
    abstracts_data = download_and_extract_json(ABSTRACTS_URL)
    if abstracts_data is None:
        logging.error("Failed to retrieve abstracts data. Exiting.")
        return
    
    # Analyze the date distribution in the dataset
    analysis_results = analyze_paper_dates(abstracts_data)
    
    # Find papers published after the cutoff date
    new_papers = find_papers_after_cutoff(abstracts_data, CUTOFF_DATE)
    
    # Generate and display summary report
    summary_report = generate_summary_report(analysis_results, new_papers)
    print(summary_report)
    
    # Save results to file if new papers found
    if new_papers:
        try:
            output_data = {
                "analysis_date": datetime.now(timezone.utc).isoformat(),
                "cutoff_date": CUTOFF_DATE,
                "total_new_papers": len(new_papers),
                "analysis_results": analysis_results,
                "new_papers": new_papers,
                "summary_report": summary_report
            }
            
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
            
            logging.info(f"Results saved to {OUTPUT_FILE}")
            
        except Exception as e:
            logging.error(f"Error saving results to file: {e}")
    
    # Log completion
    elapsed_time = time.time() - start_time
    logging.info(f"Analysis completed in {elapsed_time:.2f} seconds")
    
    # Return summary for potential use by other scripts
    return {
        "new_papers_count": len(new_papers),
        "latest_date": analysis_results.get('stats', {}).get('latest_date'),
        "data_appears_fresh": len(new_papers) > 0,
        "elapsed_time": elapsed_time
    }

if __name__ == "__main__":
    main()
