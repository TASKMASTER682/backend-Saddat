const Interest = require('../models/Interest');
const User = require('../models/User');

// GET /api/interests - Get my interests (sent and received)
exports.getMyInterests = async (req, res) => {
  try {
    const [sent, received] = await Promise.all([
      Interest.find({ fromUser: req.user._id })
        .populate('toUser', 'name role fatherId')
        .sort({ createdAt: -1 }),
      Interest.find({ toUser: req.user._id })
        .populate('fromUser', 'name role fatherId')
        .sort({ createdAt: -1 }),
    ]);

    res.json({ success: true, data: { sent, received } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/interests/spouse-seekers - Get all open for spouse
exports.getSpouseSeekers = async (req, res) => {
  try {
    const seekers = await User.find({
      isOpenForSpouse: true,
      _id: { $ne: req.user._id },
    })
      .select('name role fatherId spouseSearchBio contributions isAlive gender')
      .populate('fatherId', 'name')
      .lean();

    const seekerIds = seekers.map(s => s._id);
    const myInterests = await Interest.find({
      fromUser: req.user._id,
      toUser: { $in: seekerIds },
      type: 'interested',
    }).select('toUser status');

    const interestMap = {};
    myInterests.forEach(i => {
      interestMap[i.toUser.toString()] = i.status;
    });

    const result = seekers.map(s => ({
      ...s,
      myInterest: interestMap[s._id.toString()] || null,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/interests/pin - Pin a member (parent approach)
exports.pinMember = async (req, res) => {
  try {
    const { toUserId, message } = req.body;

    if (!toUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID required' });
    }

    if (toUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot pin yourself' });
    }

    const targetUser = await User.findById(toUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.gender === 'female') {
      return res.status(400).json({ success: false, message: 'Can only pin male members' });
    }

    const existing = await Interest.findOne({
      fromUser: req.user._id,
      toUser: toUserId,
      type: 'pin',
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already pinned this member' });
    }

    const interest = await Interest.create({
      fromUser: req.user._id,
      toUser: toUserId,
      type: 'pin',
      message,
    });

    await interest.populate('toUser', 'name role');

    res.status(201).json({ success: true, data: interest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/interests/interested - Mark interest (spouse search approach)
exports.markInterested = async (req, res) => {
  try {
    const { toUserId, message } = req.body;

    if (!toUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID required' });
    }

    const targetUser = await User.findById(toUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!targetUser.isOpenForSpouse) {
      return res.status(400).json({ success: false, message: 'This member is not open for spouse search' });
    }

    // Check if opposite gender
    if (req.user.gender === targetUser.gender) {
      return res.status(400).json({ success: false, message: 'You can only express interest in opposite gender' });
    }

    const existing = await Interest.findOne({
      fromUser: req.user._id,
      toUser: toUserId,
      type: 'interested',
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already marked interest' });
    }

    const interest = await Interest.create({
      fromUser: req.user._id,
      toUser: toUserId,
      type: 'interested',
      message,
    });

    await interest.populate('toUser', 'name role');

    res.status(201).json({ success: true, data: interest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/interests/suggestion - Send a suggestion without marking interest
exports.sendSuggestion = async (req, res) => {
  try {
    const { toUserId, message } = req.body;

    if (!toUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID required' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Suggestion message is required' });
    }

    if (message.trim().length > 250) {
      return res.status(400).json({ success: false, message: 'Suggestion must be 50 words or less (~250 characters)' });
    }

    const targetUser = await User.findById(toUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!targetUser.isOpenForSpouse) {
      return res.status(400).json({ success: false, message: 'This member is not open for spouse search' });
    }

    const interest = await Interest.create({
      fromUser: req.user._id,
      toUser: toUserId,
      type: 'suggestion',
      message: message.trim(),
      status: 'pending',
    });

    await interest.populate('fromUser', 'name role');

    res.status(201).json({ success: true, data: interest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/interests/:id/respond - Accept or reject interest
exports.respondInterest = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const interest = await Interest.findOne({
      _id: req.params.id,
      toUser: req.user._id,
    }).populate('fromUser', 'name fatherId gender');

    if (!interest) {
      return res.status(404).json({ success: false, message: 'Interest not found' });
    }

    interest.status = status;
    await interest.save();
    await interest.populate('fromUser', 'name role fatherId gender');
    await interest.populate('toUser', 'name role fatherId gender');

    // If accepted, notify both fathers
    if (status === 'accepted') {
      const fromUser = interest.fromUser;
      const toUser = interest.toUser;
      const fromFather = fromUser.fatherId;
      const toFather = toUser.fatherId;

      const fromUserGender = fromUser.gender === 'female' ? 'daughter' : 'son';
      const toUserGender = toUser.gender === 'female' ? 'daughter' : 'son';

      // Create notifications for both fathers
      const notifications = [];

      if (fromFather) {
        notifications.push({
          userId: fromFather._id,
          type: 'interest_accepted',
          title: 'Alliance Interest Accepted',
          message: `Good news! ${toUser.name} (father: ${toFather?.name || 'Unknown'}) has shown interest in your ${fromUserGender} ${fromUser.name}. Contact their family to proceed.`,
          relatedInterestId: interest._id,
        });
      }

      if (toFather) {
        notifications.push({
          userId: toFather._id,
          type: 'interest_accepted',
          title: 'Alliance Interest Received',
          message: `${fromUser.name} (father: ${fromFather?.name || 'Unknown'}) is interested in your ${toUserGender} ${toUser.name}. Contact their family to proceed.`,
          relatedInterestId: interest._id,
        });
      }

      if (notifications.length > 0) {
        const Notification = require('../models/Notification');
        await Notification.insertMany(notifications);
      }
    }

    res.json({ success: true, data: interest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/interests/:id - Cancel my interest/pin (can delete if user is fromUser or toUser)
exports.cancelInterest = async (req, res) => {
  try {
    const interest = await Interest.findOne({
      _id: req.params.id,
      $or: [
        { fromUser: req.user._id },
        { toUser: req.user._id },
      ],
    });

    if (!interest) {
      return res.status(404).json({ success: false, message: 'Interest not found' });
    }

    await Interest.findByIdAndDelete(interest._id);

    res.json({ success: true, message: 'Interest removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
