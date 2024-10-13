const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf("BOT_API");

//mongodb://localhost:27017/Name_DB
mongoose.connect("//mongodb://localhost:27017/Name_DB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Successfully connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1); // Завершаем процесс в случае ошибки подключения
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const userSchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,
  firstName: String,
  lastName: String,
  teaPoints: { type: Number, default: 0 },
  lastUsed: Date,
});

const User = mongoose.model('User', userSchema);

// Устанавливаем команды бота
bot.telegram.setMyCommands([
  { command: 'tea', description: 'Получить очки чая' },
  { command: 'beer', description: 'Выпить пиво' },
  { command: 'wine', description: 'Выпить вино' },
  { command: 'cognac', description: 'Выпить коньяк' },
  { command: 'vodka', description: 'Выпить водку' },
  { command: 'chatstats', description: 'Показать статистику чата' },
  { command: 'mystats', description: 'Показать мою статистику' }
]);

const DRINKS = {
  tea: 'чая',
  beer: 'пива',
  wine: 'вина',
  cognac: 'коньяка',
  vodka: 'водки'
};

async function handleDrinkCommand(ctx, drinkType) {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Пожалуйста, добавьте бота в чат, чтобы использовать эту команду.', 
    Markup.inlineKeyboard([
      Markup.button.url('Добавить бота в чат', `https://t.me/${bot.botInfo.username}?startgroup=true`)
    ]));
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';

  let user = await User.findOne({ userId, chatId });

  if (!user) {
    user = new User({
      userId,
      chatId,
      firstName,
      lastName,
      teaPoints: 0,
      lastUsed: new Date(0),
    });
  } else {
    user.firstName = firstName;
    user.lastName = lastName;
  }

  const now = new Date();
  const cooldown = 4 * 60 * 60 * 1000; // 4 часа в миллисекундах

  if (now - user.lastUsed < cooldown) {
    const remainingTime = new Date(cooldown - (now - user.lastUsed));
    return ctx.reply(
      `Вы уже использовали команду недавно. Попробуйте снова через ${remainingTime.getUTCHours()} часов и ${remainingTime.getUTCMinutes()} минут.`
    );
  }

  const points = Math.floor(Math.random() * 10) + 1;
  user.teaPoints += points;
  user.lastUsed = now;
  await user.save();

  ctx.replyWithMarkdown(
    `[${firstName} ${lastName}](tg://user?id=${userId}), выпили ${points} литров ${DRINKS[drinkType]}! Всего у вас теперь ${user.teaPoints} литров.`
  );
}

// Обработка команд для различных напитков
bot.command('tea', (ctx) => handleDrinkCommand(ctx, 'tea'));
bot.command('beer', (ctx) => handleDrinkCommand(ctx, 'beer'));
bot.command('wine', (ctx) => handleDrinkCommand(ctx, 'wine'));
bot.command('cognac', (ctx) => handleDrinkCommand(ctx, 'cognac'));
bot.command('vodka', (ctx) => handleDrinkCommand(ctx, 'vodka'));

// Статистика всего чата
bot.command('chatstats', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Пожалуйста, добавьте бота в чат, чтобы использовать эту команду.', 
    Markup.inlineKeyboard([
      Markup.button.url('Добавить бота в чат', `https://t.me/${bot.botInfo.username}?startgroup=true`)
    ]));
  }

  const chatId = ctx.chat.id;
  const users = await User.find({ chatId }).sort({ teaPoints: -1 }).limit(15);

  if (users.length === 0) {
    return ctx.reply('В этом чате еще нет данных.');
  }

  let stats = '🍵 Топ-15 игроков чата:\n\n';
  users.forEach((user, index) => {
    stats += `[${++index}. ${user.firstName} ${user.lastName}] - ${user.teaPoints} л\n`;
  });
  stats += "\n\nЧтобы попасть в этот список, начните игру с помощью команды /tea\n\nТОП лучших игроков - /top"
  ctx.replyWithMarkdown(stats);
});

// Статистика конкретного пользователя
bot.command('mystats', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Пожалуйста, добавьте бота в чат, чтобы использовать эту команду.', 
    Markup.inlineKeyboard([
      Markup.button.url('Добавить бота в чат', `https://t.me/${bot.botInfo.username}?startgroup=true`)
    ]));
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const user = await User.findOne({ userId, chatId });

  if (!user) {
    return ctx.reply('У вас еще нет очков.');
  }

  ctx.replyWithMarkdown(`🍵Профиль \n 👤[${user.firstName} ${user.lastName}](tg://user?id=${user.userId})\n🤯 Всего: ${user.teaPoints} литров.\n`);
});

// Обработка inline запросов для подсказок
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.toLowerCase();

  const results = [
    { id: '1', type: 'article', title: '/tea', input_message_content: { message_text: '/tea' }, description: 'Получить очки чая' },
    { id: '2', type: 'article', title: '/beer', input_message_content: { message_text: '/beer' }, description: 'Выпить пиво' },
    { id: '3', type: 'article', title: '/wine', input_message_content: { message_text: '/wine' }, description: 'Выпить вино' },
    { id: '4', type: 'article', title: '/cognac', input_message_content: { message_text: '/cognac' }, description: 'Выпить коньяк' },
    { id: '5', type: 'article', title: '/vodka', input_message_content: { message_text: '/vodka' }, description: 'Выпить водку' },
    { id: '6', type: 'article', title: '/chatstats', input_message_content: { message_text: '/chatstats' }, description: 'Показать статистику чата' },
    { id: '7', type: 'article', title: '/mystats', input_message_content: { message_text: '/mystats' }, description: 'Показать мою статистику' }
  ].filter(command => command.title.includes(query));

  ctx.answerInlineQuery(results);
});

bot.launch();
console.log('Bot is running...');