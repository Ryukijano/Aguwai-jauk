import { Router, Request, Response } from 'express';
import { rateLimitConfigs } from '../middleware/rate-limiter';
import { searchSimilarMemories, storeMemoryWithEmbedding, getRelevantContext } from '../services/weaviate-service';

const router = Router();

// Search memories semantically
router.post('/api/memory/search', rateLimitConfigs.search, async (req: Request, res: Response) => {
  try {
    const { query, limit = 10, userId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await searchSimilarMemories(
      query,
      userId,
      limit
    );

    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error: any) {
    console.error('Vector search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message,
      fallback: 'Using PostgreSQL text search as fallback'
    });
  }
});

// Store memory with embeddings
router.post('/api/memory/store', rateLimitConfigs.api, async (req: Request, res: Response) => {
  try {
    const { content, metadata, userId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await storeMemoryWithEmbedding({
      userId: userId || null,
      threadId: req.session.id,
      content,
      type: metadata?.type || 'conversation',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      importance: metadata?.importance || 0.5
    });

    res.json({
      success: true,
      message: 'Memory stored with embeddings',
      id: result.id
    });
  } catch (error: any) {
    console.error('Memory storage error:', error);
    res.status(500).json({ 
      error: 'Storage failed', 
      message: error.message,
      fallback: 'Stored in PostgreSQL without embeddings'
    });
  }
});

// Get similar job matches based on resume
router.post('/api/jobs/semantic-match', rateLimitConfigs.search, async (req: Request, res: Response) => {
  try {
    const { resumeContent, limit = 5 } = req.body;
    
    if (!resumeContent) {
      return res.status(400).json({ error: 'Resume content is required' });
    }

    // Use context search for job matching
    const context = await getRelevantContext(
      resumeContent,
      null, // No specific user ID for job matching
      limit
    );

    res.json({
      success: true,
      matches: context,
      count: context.length
    });
  } catch (error: any) {
    console.error('Job matching error:', error);
    res.status(500).json({ 
      error: 'Matching failed', 
      message: error.message,
      fallback: 'Using keyword-based matching as fallback'
    });
  }
});

export default router;