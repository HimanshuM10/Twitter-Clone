const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// Get all posts
router.get('/getPosts', async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate({
        path: 'originalPostRef',
        select: 'postedBy postedOn rePost like',
        model: 'Post',
      })
      .populate({
        path: 'postedBy',
        select: 'username email',
        model: 'User',
      })
      .sort({ createdAt: -1 });

    if (posts.length > 0) {
      res.status(200).json({ posts });
    } else {
      res.status(404).json({ message: 'No posts found.' });
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Create a new post
router.post('/createPost', async (req, res) => {
  const { content, userId, rePost, postId } = req.body;

  try {
    if (!content) return res.status(400).json({ message: 'Post content cannot be empty' });
    if (!userId) return res.status(400).json({ message: 'Missing user id in the request body' });

    let data;

    if (rePost) {
      if (!postId) return res.status(400).json({ message: 'Missing postId in the request body' });

      data = {
        content,
        postedBy: userId,
        rePost,
        originalPostRef: postId,
      };
    } else {
      data = {
        content,
        postedBy: userId,
      };
    }

    const newPost = new Post(data);
    const savedPost = await newPost.save();
    const populatedPost = await savedPost.populate('postedBy', 'username email').execPopulate();

    res.status(201).json({ message: `${rePost ? 'ReTweeted' : 'Posted'}`, post: populatedPost });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Handle Retweet
router.post('/reTweet', async (req, res) => {
  const { content, userId, postId } = req.body;

  try {
    if (!content) return res.status(400).json({ message: 'Post content cannot be empty' });
    if (!userId) return res.status(400).json({ message: 'Missing user id in the request body' });
    if (!postId) return res.status(400).json({ message: 'Missing postId in the request body' });

    const originalPost = await Post.findById(postId);

    if (!originalPost) return res.status(404).json({ message: 'Requested post not found in the database' });

    if (!originalPost.rePost.includes(userId)) {
      await originalPost.updateOne({ $push: { rePost: userId } });
      const newPost = new Post({
        content,
        postedBy: userId,
        isRePost: true,
        originalPostRef: postId,
      });
      const result = await newPost.save();
      return res.status(201).json({ message: 'Successfully ReTweeted', post: result });
    } else {
      await originalPost.updateOne({ $pull: { rePost: userId } });
      const filter = { postedBy: userId, originalPostRef: postId, isRePost: true };
      await Post.findOneAndDelete(filter);
      return res.status(200).json({ message: 'Successfully UnTweeted' });
    }
  } catch (error) {
    console.error('Error handling Retweet:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Delete a post
router.delete('/deletePost/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const deletedPost = await Post.findByIdAndDelete(postId);

    if (!deletedPost) return res.status(404).json({ message: 'Post not found' });

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Handle post likes
router.put('/likePost/:postId/:userId', async (req, res) => {
  const { postId, userId } = req.params;

  try {
    if (!postId) return res.status(400).json({ message: 'Missing post id in the request' });
    if (!userId) return res.status(400).json({ message: 'Missing user id in the request' });

    const post = await Post.findById(postId);

    if (!post) return res.status(404).json({ message: 'Requested post not found in the database' });

    if (!post.like.includes(userId)) {
      await post.updateOne({ $push: { like: userId } });
      return res.status(200).json({ message: 'Liked' });
    } else {
      await post.updateOne({ $pull: { like: userId } });
      return res.status(200).json({ message: 'Unliked' });
    }
  } catch (error) {
    console.error('Error handling post like:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;
