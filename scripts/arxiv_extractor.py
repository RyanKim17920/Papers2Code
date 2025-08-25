#!/usr/bin/env python3
"""
ArXiv Data Extractor

This module replaces the Papers with Code data extraction with ArXiv data.
Since PWC has been sunsetted, we now extract papers directly from ArXiv API.

Author: GitHub Copilot Assistant
"""

import arxiv
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Set
import polars as pl

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ArXiv categories that typically contain papers that might need code implementations
RELEVANT_ARXIV_CATEGORIES = [
    "cs.CV",  # Computer Vision and Pattern Recognition
    "cs.LG",  # Machine Learning 
    "cs.AI",  # Artificial Intelligence
    "cs.CL",  # Computation and Language (NLP)
    "cs.IR",  # Information Retrieval
    "cs.NE",  # Neural and Evolutionary Computing
    "cs.RO",  # Robotics
    "stat.ML",  # Machine Learning (Statistics)
    "eess.IV",  # Image and Video Processing
    "eess.SP",  # Signal Processing
]

class ArxivExtractor:
    """
    Extracts paper metadata from ArXiv API and converts it to a format
    compatible with the existing Papers2Code database structure.
    """
    
    def __init__(self, max_results_per_query: int = 1000, delay_between_queries: float = 3.0):
        """
        Initialize the ArXiv extractor.
        
        Args:
            max_results_per_query: Maximum papers to fetch per API call
            delay_between_queries: Delay between API calls to respect rate limits
        """
        self.max_results_per_query = max_results_per_query
        self.delay_between_queries = delay_between_queries
        self.client = arxiv.Client()
        
    def extract_papers_since_date(
        self, 
        since_date: datetime, 
        categories: Optional[List[str]] = None,
        max_total_results: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract papers from ArXiv published since the given date.
        
        Args:
            since_date: Extract papers published after this date
            categories: List of ArXiv categories to search (default: RELEVANT_ARXIV_CATEGORIES)
            max_total_results: Maximum total papers to extract (None for no limit)
            
        Returns:
            List of paper dictionaries in PWC-compatible format
        """
        if categories is None:
            categories = RELEVANT_ARXIV_CATEGORIES
            
        logging.info(f"Extracting ArXiv papers since {since_date.isoformat()}")
        logging.info(f"Categories: {categories}")
        
        all_papers = []
        
        for category in categories:
            logging.info(f"Processing category: {category}")
            
            try:
                papers = self._extract_papers_for_category(
                    category, 
                    since_date, 
                    max_total_results
                )
                
                logging.info(f"Found {len(papers)} papers in category {category}")
                all_papers.extend(papers)
                
                # Rate limiting
                if len(categories) > 1:  # Only sleep if multiple categories
                    time.sleep(self.delay_between_queries)
                    
            except Exception as e:
                logging.error(f"Error processing category {category}: {e}")
                continue
        
        # Remove duplicates (papers can appear in multiple categories)
        unique_papers = self._deduplicate_papers(all_papers)
        
        logging.info(f"Total unique papers extracted: {len(unique_papers)}")
        return unique_papers
    
    def _extract_papers_for_category(
        self, 
        category: str, 
        since_date: datetime,
        max_results: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Extract papers for a specific ArXiv category."""
        
        # Format date for ArXiv query (YYYYMMDD format)
        date_str = since_date.strftime("%Y%m%d")
        
        # Construct search query
        # ArXiv date queries use submittedDate:[YYYYMMDD TO *]
        query = f"cat:{category} AND submittedDate:[{date_str} TO *]"
        
        logging.debug(f"ArXiv query: {query}")
        
        papers = []
        start_index = 0
        
        while True:
            try:
                # Create search
                search = arxiv.Search(
                    query=query,
                    max_results=self.max_results_per_query,
                    sort_by=arxiv.SortCriterion.SubmittedDate,
                    sort_order=arxiv.SortOrder.Descending
                )
                
                batch_papers = []
                for paper in self.client.results(search):
                    # Check if paper is actually after our date (ArXiv date filtering can be imprecise)
                    if paper.published.replace(tzinfo=timezone.utc) >= since_date:
                        converted_paper = self._convert_arxiv_paper_to_pwc_format(paper)
                        if converted_paper:
                            batch_papers.append(converted_paper)
                    
                    # Check limits
                    if max_results and len(papers) + len(batch_papers) >= max_results:
                        batch_papers = batch_papers[:max_results - len(papers)]
                        break
                
                if not batch_papers:
                    break
                    
                papers.extend(batch_papers)
                logging.debug(f"Batch extracted {len(batch_papers)} papers for {category}")
                
                # Check if we've hit our limit
                if max_results and len(papers) >= max_results:
                    break
                    
                # Check if we got fewer results than requested (end of results)
                if len(batch_papers) < self.max_results_per_query:
                    break
                
                start_index += self.max_results_per_query
                
                # Rate limiting between batches
                time.sleep(1.0)
                
            except Exception as e:
                logging.error(f"Error in batch extraction for {category}: {e}")
                break
        
        return papers
    
    def _convert_arxiv_paper_to_pwc_format(self, paper: arxiv.Result) -> Optional[Dict[str, Any]]:
        """
        Convert an ArXiv paper to PWC-compatible format.
        
        Args:
            paper: ArXiv paper result object
            
        Returns:
            Dictionary in PWC format, or None if conversion fails
        """
        try:
            # Extract ArXiv ID from URL
            arxiv_id = paper.entry_id.split('/')[-1]
            if 'v' in arxiv_id:
                arxiv_id = arxiv_id.split('v')[0]  # Remove version number
            
            # Convert categories to list of strings
            categories = [cat.split('.') for cat in paper.categories]
            category_strings = ['.'.join(cat) for cat in categories]
            
            converted = {
                "paper_url": f"https://arxiv.org/abs/{arxiv_id}",  # Use ArXiv URL as primary URL
                "title": paper.title.strip(),
                "abstract": paper.summary.strip() if paper.summary else "",
                "authors": [author.name for author in paper.authors] if paper.authors else [],
                "url_abs": f"https://arxiv.org/abs/{arxiv_id}",
                "url_pdf": paper.pdf_url if paper.pdf_url else f"https://arxiv.org/pdf/{arxiv_id}.pdf",
                "arxiv_id": arxiv_id,
                "date": paper.published.strftime("%Y-%m-%d"),
                "proceeding": "arXiv",  # Set venue as arXiv
                "tasks": category_strings,  # Use ArXiv categories as tasks
            }
            
            return converted
            
        except Exception as e:
            logging.warning(f"Failed to convert paper {paper.entry_id}: {e}")
            return None
    
    def _deduplicate_papers(self, papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate papers based on ArXiv ID."""
        seen_ids = set()
        unique_papers = []
        
        for paper in papers:
            arxiv_id = paper.get("arxiv_id")
            if arxiv_id and arxiv_id not in seen_ids:
                seen_ids.add(arxiv_id)
                unique_papers.append(paper)
        
        duplicates_removed = len(papers) - len(unique_papers)
        if duplicates_removed > 0:
            logging.info(f"Removed {duplicates_removed} duplicate papers")
            
        return unique_papers

def get_last_update_timestamp(default_days_back: int = 7) -> datetime:
    """
    Get the timestamp of the last update.
    
    For now, this returns a default timestamp. In production, this should
    read from a database or config file to track the last successful update.
    
    Args:
        default_days_back: Number of days to go back if no last update found
        
    Returns:
        Datetime of last update
    """
    # TODO: In production, read this from database or config
    # For now, go back a week by default
    default_timestamp = datetime.now(timezone.utc) - timedelta(days=default_days_back)
    
    logging.info(f"Using default last update timestamp: {default_timestamp.isoformat()}")
    return default_timestamp

def extract_new_arxiv_papers(
    since_date: Optional[datetime] = None,
    categories: Optional[List[str]] = None,
    max_results: Optional[int] = None
) -> pl.LazyFrame:
    """
    Extract new papers from ArXiv and return as Polars LazyFrame.
    
    Args:
        since_date: Date to extract papers since (defaults to last week)
        categories: ArXiv categories to search (defaults to RELEVANT_ARXIV_CATEGORIES)
        max_results: Maximum papers to extract (None for no limit)
        
    Returns:
        Polars LazyFrame with papers in PWC-compatible format
    """
    if since_date is None:
        since_date = get_last_update_timestamp()
    
    extractor = ArxivExtractor()
    papers = extractor.extract_papers_since_date(
        since_date=since_date,
        categories=categories,
        max_total_results=max_results
    )
    
    if not papers:
        logging.warning("No papers extracted from ArXiv")
        # Return empty LazyFrame with correct schema
        schema = {
            "paper_url": pl.Utf8, "title": pl.Utf8, "abstract": pl.Utf8,
            "authors": pl.List(pl.Utf8), "url_abs": pl.Utf8, "url_pdf": pl.Utf8,
            "arxiv_id": pl.Utf8, "date": pl.Utf8, "proceeding": pl.Utf8, "tasks": pl.List(pl.Utf8)
        }
        return pl.DataFrame(schema=schema).lazy()
    
    # Convert to Polars LazyFrame
    papers_df = pl.LazyFrame(papers)
    
    logging.info(f"Created LazyFrame with {len(papers)} papers")
    return papers_df

if __name__ == "__main__":
    # Test the extractor
    logging.info("Testing ArXiv extractor...")
    
    # Extract papers from the last 3 days for testing
    test_date = datetime.now(timezone.utc) - timedelta(days=3)
    
    try:
        papers_lf = extract_new_arxiv_papers(
            since_date=test_date,
            categories=["cs.CV"],  # Just test with Computer Vision
            max_results=5  # Limit for testing
        )
        
        # Collect and display results
        papers_df = papers_lf.collect()
        print(f"Extracted {papers_df.height} papers")
        
        if papers_df.height > 0:
            print("Sample paper:")
            print(papers_df.select(["title", "arxiv_id", "date", "tasks"]).head(1))
        
    except Exception as e:
        logging.error(f"Test failed: {e}")
        print("Note: This test requires network access to ArXiv API")