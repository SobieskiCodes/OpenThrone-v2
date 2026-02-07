import { Controller, Get, Post, Body } from '@nestjs/common';
import { BlogService } from './blog.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Public()
  @Get('posts')
  async getPosts() {
    // TODO: Return paginated list of published blog posts
    return this.blogService.getPosts();
  }

  @Post('posts')
  async createPost(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for create post DTO
    // TODO: Add @Roles guard for blog post creation
    return this.blogService.createPost(player.id, body);
  }
}
